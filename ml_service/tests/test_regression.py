import pytest
from fastapi.testclient import TestClient
from ml_service.main import app
from ml_service.nlp import parse_natural_language_query, sanitize_incoming_user_message, clean_text
from ml_service.engine import TravelRecommendationEngine, validate_preferences

@pytest.fixture(scope="module")
def engine():
    return TravelRecommendationEngine()

def test_1_mountain_adventure_europe_extraction(engine):
    query = "Mountain adventure in Europe for 7 days"
    prefs, follow_ups, is_ambiguous = parse_natural_language_query(query, region_lookup=engine.region_lookup)
    
    assert prefs["region"] == "Europe"
    assert prefs["duration_days"] == 7
    assert prefs.get("travel_type") == "adventure" or "adventure" in prefs.get("interests", [])
    assert "mountains" in prefs.get("interests", [])

def test_2_structured_budget_selection_preserves_preferences():
    with TestClient(app) as client:
        # Step 1: Initial query
        resp1 = client.post("/chat", json={"message": "Mountain adventure in Europe for 7 days"})
        assert resp1.status_code == 200
        data1 = resp1.json()
        prev = data1["extracted_preferences"]
        assert prev["region"] == "Europe"
        assert prev["duration_days"] == 7

        # Step 2: User clicks structured "budget" option
        resp2 = client.post("/chat", json={
            "message": "Budget",
            "previous_preferences": prev,
            "direct_preference_update": {"budget_level": "budget"}
        })
        assert resp2.status_code == 200
        data2 = resp2.json()
        updated = data2["extracted_preferences"]
        assert updated["region"] == "Europe"
        assert updated["duration_days"] == 7
        assert updated["budget_level"] == "budget"
        assert "adventure" in ([updated.get("travel_type")] + updated.get("interests", []))

def test_3_no_budget_budget_phrase():
    with TestClient(app) as client:
        # Direct budget query
        resp = client.post("/chat", json={
            "message": "Budget trip in Europe for 7 days",
            "previous_preferences": {"region": "Europe", "budget_level": "budget"}
        })
        assert resp.status_code == 200
        text = resp.json()["message"]
        assert "budget budget" not in text.lower()
        for rec in resp.json()["recommendations"]:
            assert "budget budget" not in rec["explanation"].lower()
            assert "budget budget" not in rec["trade_offs"].lower()

def test_4_conversation_state_persistence():
    with TestClient(app) as client:
        turn1 = client.post("/chat", json={"message": "Mountain adventure in Europe for 7 days"})
        p1 = turn1.json()["extracted_preferences"]
        
        turn2 = client.post("/chat", json={
            "message": "Budget",
            "previous_preferences": p1,
            "direct_preference_update": {"budget_level": "budget"}
        })
        p2 = turn2.json()["extracted_preferences"]
        assert p2["region"] == "Europe"
        assert p2["duration_days"] == 7
        assert p2["budget_level"] == "budget"

        turn3 = client.post("/chat", json={
            "message": "With my partner",
            "previous_preferences": p2
        })
        p3 = turn3.json()["extracted_preferences"]
        assert p3["region"] == "Europe"
        assert p3["duration_days"] == 7
        assert p3["budget_level"] == "budget"
        assert p3["companions"] == "couple"

def test_5_assistant_question_not_treated_as_user_input(engine):
    poisoned_input = "I prefer: What is your preferred budget range? Budget (< $50/day)"
    sanitized = sanitize_incoming_user_message(poisoned_input)
    assert "What is your preferred budget range?" not in sanitized
    
    prefs, _, _ = parse_natural_language_query(poisoned_input, region_lookup=engine.region_lookup)
    assert prefs.get("budget_level") == "budget"

def test_6_no_repeated_follow_ups():
    with TestClient(app) as client:
        resp = client.post("/chat", json={
            "message": "Budget mountain adventure in Europe for 7 days with my partner"
        })
        assert resp.status_code == 200
        follow_ups = resp.json()["follow_up_questions"]
        fields = [q.get("field") for q in resp.json().get("structured_follow_ups", [])]
        assert "budget_level" not in fields
        assert "companions" not in fields
        for q in follow_ups:
            assert "budget" not in q.lower()
            assert "partner" not in q.lower()
            assert "who is joining" not in q.lower()

def test_7_strict_budget_flags_premium_destinations(engine):
    # Europe catalog only contains premium destinations ($140 - $202/day)
    raw = {
        "travel_type": "adventure",
        "region": "Europe",
        "budget_level": "budget",
        "duration_days": 7
    }
    recs, warns, _, _ = engine.recommend(raw, top_n=5)
    # If all destinations are out-of-budget, they must be marked as alternatives
    for r in recs:
        assert r["is_alternative"] is True
        assert r["estimated_daily_cost_usd"] > 50

def test_8_usd_conversion_and_budget_tiers(engine):
    # Check that df budget_tier matches estimated_daily_cost_usd thresholds
    df = engine.df
    for _, row in df.iterrows():
        cost_usd = row["estimated_daily_cost_usd"]
        tier = row["budget_tier"]
        if cost_usd < 50:
            assert tier == "budget"
        elif cost_usd <= 130:
            assert tier == "moderate"
        else:
            assert tier == "premium"

def test_9_europe_and_mountain_constraints(engine):
    raw = {
        "travel_type": "adventure",
        "interests": ["mountains"],
        "region": "Europe",
        "duration_days": 7
    }
    recs, _, _, _ = engine.recommend(raw, top_n=5)
    assert len(recs) > 0
    for r in recs:
        # In the dataset catalog, European destinations have subregion ending in Europe and region=International
        assert "Europe" in r["subregion"]
    # Mountain destinations like Lucerne or Zurich should rank highly for mountains
    dest_names = [r["destination"] for r in recs]
    assert "Lucerne" in dest_names or "Zurich" in dest_names

def test_10_mmr_diversification_honors_hard_constraints(engine):
    raw = {
        "travel_type": "beach",
        "region": "India"
    }
    recs, _, _, _ = engine.recommend(raw, top_n=5)
    for r in recs:
        assert r["region"] == "India"

def test_11_honest_fallback_when_no_budget_matches():
    with TestClient(app) as client:
        resp = client.post("/chat", json={
            "message": "Budget",
            "previous_preferences": {
                "travel_type": "adventure",
                "interests": ["mountains"],
                "region": "Europe",
                "duration_days": 7
            },
            "direct_preference_update": {"budget_level": "budget"}
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "no destinations in our europe catalog strictly fall under the budget tier" in data["message"].lower() or "alternative" in data["message"].lower()
        for rec in data["recommendations"]:
            assert rec["is_alternative"] is True

def test_12_no_html_entities_in_explanations():
    raw_dirty = "&#x49;t rates 10/10&#x20;for beach. &#x47;ood fit; &#x4C;imited nightlife &amp; more."
    cleaned = clean_text(raw_dirty)
    assert "&#x" not in cleaned
    assert "&amp;" not in cleaned
    assert cleaned == "It rates 10/10 for beach. Good fit; Limited nightlife & more."

    with TestClient(app) as client:
        resp = client.post("/chat", json={"message": "Mountain adventure in Europe for 7 days"})
        assert resp.status_code == 200
        for rec in resp.json()["recommendations"]:
            for field in ["explanation", "trade_offs", "destination", "country"]:
                val = rec.get(field, "")
                assert "&#x" not in val
                assert "&#" not in val


def test_13_direct_preference_update_without_message():
    with TestClient(app) as client:
        resp = client.post("/chat", json={
            "direct_preference_update": {"budget_level": "moderate"},
            "previous_preferences": {"region": "India", "travel_type": "beach"}
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["extracted_preferences"]["budget_level"] == "moderate"
        assert data["extracted_preferences"]["region"] == "India"


def test_14_empty_message_and_no_update_returns_400():
    with TestClient(app) as client:
        resp = client.post("/chat", json={
            "message": "   "
        })
        assert resp.status_code == 400
        assert "Either a non-empty 'message' or 'direct_preference_update' must be provided" in resp.json()["detail"]


def test_15_flexible_and_negative_preference_clearing(engine):
    # Season clearing
    p1 = {"region": "Europe", "travel_season": "summer"}
    res1, _, _ = parse_natural_language_query("I have no preference for the season", previous_prefs=p1)
    assert "travel_season" not in res1
    assert res1["region"] == "Europe"

    # Budget clearing
    p2 = {"region": "India", "budget_level": "budget"}
    res2, _, _ = parse_natural_language_query("Any budget is fine", previous_prefs=p2)
    assert "budget_level" not in res2
    assert res2["region"] == "India"


def test_16_preference_corrections(engine):
    p = {"region": "Europe", "duration_days": 7}
    # Region correction
    res1, _, _ = parse_natural_language_query("Show me destinations in India instead", previous_prefs=p)
    assert res1["region"] == "India"
    assert res1["duration_days"] == 7

    # Duration correction
    res2, _, _ = parse_natural_language_query("Actually, make it 5 days", previous_prefs=p)
    assert res2["duration_days"] == 5
    assert res2["region"] == "Europe"


def test_17_excessively_long_message_rejected():
    with TestClient(app) as client:
        resp = client.post("/chat", json={
            "message": "a" * 1001
        })
        assert resp.status_code == 422

