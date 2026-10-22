import pytest
from ml_service.engine import (
    TravelRecommendationEngine,
    validate_preferences,
    PreferenceValidationError
)

@pytest.fixture(scope="module")
def engine():
    return TravelRecommendationEngine()

def test_validate_preferences_valid(engine):
    """Verify that standard valid questionnaire answers parse correctly."""
    raw = {
        "travel_type": "beach",
        "companions": "couple",
        "budget_level": "moderate",
        "duration_days": "4-6",
        "region": "India",
        "interests": ["relaxation", "sightseeing"],
        "travel_pace": "relaxed",
        "travel_season": "winter"
    }
    prefs, warns = validate_preferences(raw, region_lookup=engine.region_lookup)
    assert prefs["travel_type"] == "beach"
    assert prefs["companions"] == "couple"
    assert prefs["budget_level"] == "moderate"
    assert prefs["duration_min"] == 4
    assert prefs["duration_max"] == 6
    assert prefs["region"]["value"] == "India"
    assert prefs["season"] == "winter"

def test_validate_preferences_aliases(engine):
    """Verify alias normalization (e.g., luxury -> premium, alone -> solo)."""
    raw = {
        "travel_type": "beaches",
        "companions": "partner",
        "budget_level": "luxury",
        "interests": ["cultural", "relaxing"]
    }
    prefs, _ = validate_preferences(raw, region_lookup=engine.region_lookup)
    assert prefs["travel_type"] == "beach"
    assert prefs["companions"] == "couple"
    assert prefs["budget_level"] == "premium"
    assert "culture" in prefs["interests"]
    assert "relaxation" in prefs["interests"]

def test_validate_preferences_invalid_budget(engine):
    """Verify that an unsupported budget level raises PreferenceValidationError."""
    raw = {"budget_level": "super_billionaire"}
    with pytest.raises(PreferenceValidationError) as exc_info:
        validate_preferences(raw, region_lookup=engine.region_lookup)
    assert "budget_level 'super_billionaire' is not valid" in str(exc_info.value)

def test_validate_preferences_invalid_duration(engine):
    """Verify that invalid duration string raises PreferenceValidationError."""
    raw = {"duration_days": "invalid_days"}
    with pytest.raises(PreferenceValidationError) as exc_info:
        validate_preferences(raw, region_lookup=engine.region_lookup)
    assert "duration_days" in str(exc_info.value)

def test_recommendation_scoring_bounds(engine):
    """Verify that all match scores lie within [0, 100]."""
    raw = {
        "travel_type": "adventure",
        "budget_level": "moderate",
        "companions": "friends",
        "duration_days": 5
    }
    recs, _, _, weights = engine.recommend(raw, top_n=5)
    assert len(recs) == 5
    for r in recs:
        assert 0.0 <= r["match_score"] <= 100.0
        assert r["destination"]
        assert r["country"]
        assert r["explanation"]
        assert r["trade_offs"]

def test_recommendation_filtering_by_region(engine):
    """Verify that region filter strictly excludes out-of-region destinations."""
    raw = {
        "travel_type": "beach",
        "region": "India"
    }
    recs, _, _, _ = engine.recommend(raw, top_n=5)
    assert len(recs) > 0
    for r in recs:
        assert r["region"] == "India"

def test_recommendation_explanations_grounded(engine):
    """Verify that explanation strings cite specific attributes."""
    raw = {
        "travel_type": "beach",
        "budget_level": "budget",
        "companions": "solo",
        "duration_days": 4
    }
    recs, _, _, _ = engine.recommend(raw, top_n=3)
    top_rec = recs[0]
    assert "budget" in top_rec["explanation"].lower() or "cost" in top_rec["explanation"].lower()
