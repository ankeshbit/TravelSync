from ml_service.nlp import parse_natural_language_query
from ml_service.engine import TravelRecommendationEngine

def test_nlp_full_travel_query():
    engine = TravelRecommendationEngine()
    query = "Looking for a relaxing beach trip in India on a budget with my partner for 5 days"
    prefs, follow_ups, is_ambiguous = parse_natural_language_query(query, region_lookup=engine.region_lookup)

    assert not is_ambiguous
    assert prefs["budget_level"] == "budget"
    assert prefs["companions"] == "couple"
    assert prefs["region"] == "India"
    assert prefs["duration_days"] == 5
    assert "beach" in ([prefs.get("travel_type")] + prefs.get("interests", []))

def test_nlp_ambiguous_query():
    engine = TravelRecommendationEngine()
    query = "I want to travel"
    prefs, follow_ups, is_ambiguous = parse_natural_language_query(query, region_lookup=engine.region_lookup)

    assert is_ambiguous
    assert len(follow_ups) > 0

def test_nlp_conversational_refinement():
    engine = TravelRecommendationEngine()
    # Turn 1: initial query
    prev_prefs, _, _ = parse_natural_language_query("Mountain adventure in Europe", region_lookup=engine.region_lookup)
    # Turn 2: user refines with duration and budget
    refined_prefs, _, _ = parse_natural_language_query("Make it luxury for 7 days", previous_prefs=prev_prefs, region_lookup=engine.region_lookup)

    assert refined_prefs["region"] == "Europe"
    assert refined_prefs["budget_level"] == "premium"
    assert refined_prefs["duration_days"] == 7
    assert "adventure" in ([refined_prefs.get("travel_type")] + refined_prefs.get("interests", []))
