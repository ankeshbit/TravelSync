import re
import html
from typing import Dict, Any, List, Tuple, Optional

# Canonical controlled vocabularies
THEME_KEYWORDS = {
    "mountains": ["mountain", "mountains", "hills", "hill station", "snow", "himalayas", "alps", "high altitude"],
    "adventure": ["adventure", "trek", "trekking", "hiking", "rafting", "scuba", "diving", "thrill", "bungee", "outdoor"],
    "beach": ["beach", "beaches", "coast", "coastal", "island", "sea", "ocean", "sunbathe", "sand"],
    "relaxation": ["relax", "relaxation", "relaxing", "peaceful", "quiet", "calm", "serene", "wellness", "spa", "chill", "unwind"],
    "wildlife": ["wildlife", "safari", "animals", "jungle", "national park", "tiger", "birds", "nature reserve"],
    "nature": ["nature", "scenic", "greenery", "forest", "lakes", "waterfalls", "landscapes", "flora"],
    "culture": ["culture", "cultural", "heritage", "history", "historical", "temple", "monuments", "architecture", "tradition", "museum"],
    "spiritual": ["spiritual", "pilgrimage", "ashram", "meditation", "holy", "sacred", "ghats", "temples"],
    "city": ["city", "urban", "nightlife", "shopping", "metropolis", "modern", "skyline"],
    "sightseeing": ["sightseeing", "landmarks", "tourist spots", "attractions", "iconic places"]
}

# Synonyms for budget normalization -> canonical values ("budget", "moderate", "premium")
BUDGET_KEYWORDS = {
    "budget": [
        "budget", "cheap", "backpacking", "affordable", "low cost", "low-cost",
        "low", "economical", "inexpensive", "on a budget"
    ],
    "moderate": [
        "moderate", "mid-range", "mid range", "medium budget", "standard",
        "balanced budget", "reasonable", "medium", "mid"
    ],
    "premium": [
        "premium", "luxury", "luxurious", "expensive", "high-end", "high end",
        "5-star", "first class", "deluxe", "high"
    ]
}

COMPANION_KEYWORDS = {
    "family_with_kids": ["family with kids", "family with children", "with kids", "with children", "with toddlers", "kids", "children"],
    "family_with_parents": ["family with parents", "with parents", "with seniors", "with elderly", "with family elders"],
    "family": ["family", "relatives"],
    "solo": ["solo", "alone", "by myself", "single traveler"],
    "couple": ["couple", "honeymoon", "partner", "wife", "husband", "boyfriend", "girlfriend", "romantic"],
    "friends": ["friends", "group of friends", "buddies", "gang", "mates"]
}

PACE_KEYWORDS = {
    "relaxed": ["relaxed", "slow pace", "easygoing", "chill", "laid-back", "take it easy", "leisurely", "slow", "easy"],
    "balanced": ["balanced", "normal pace", "steady", "standard pace", "moderate pace", "medium"],
    "fast": ["fast", "fast paced", "packed", "action-packed", "quick", "cover as much as possible", "busy"]
}

SEASONS_KEYWORDS = {
    "winter": ["winter", "december", "january", "february", "snowy season", "cold weather"],
    "spring": ["spring", "march", "april", "may", "blossom"],
    "summer": ["summer", "june", "july", "august", "sunny"],
    "autumn": ["autumn", "fall", "september", "october", "november"]
}

MONTH_MAP = {
    "january": 1, "jan": 1,
    "february": 2, "feb": 2,
    "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "may": 5,
    "june": 6, "jun": 6,
    "july": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12
}


def clean_text(text: Optional[str]) -> str:
    """Decodes HTML entities and normalizes whitespace so text is clean plain-text."""
    if not text:
        return ""
    cleaned = html.unescape(text)
    # Ensure no lingering hex or decimal entities remain
    cleaned = re.sub(r'&#x([0-9a-fA-F]+);', lambda m: chr(int(m.group(1), 16)), cleaned)
    cleaned = re.sub(r'&#([0-9]+);', lambda m: chr(int(m.group(1))), cleaned)
    return cleaned.strip()


def sanitize_incoming_user_message(message: str) -> str:
    """Strips echoed assistant prompt text if user clicked a raw question string."""
    text = clean_text(message)
    # If the message looks like 'I prefer: What is your preferred budget range (budget, moderate, or luxury)?'
    # we strip out the echoed question wrapper so it doesn't cross-contaminate parsing.
    text_lower = text.lower()
    if "what is your preferred budget" in text_lower or "budget range" in text_lower:
        # Check if the user appended an answer or clicked a specific option
        m = re.search(r"\b(budget|cheap|low-cost|moderate|mid-range|luxury|premium)\b", text_lower)
        if m:
            return m.group(1)
        return ""
    if "who are you traveling with" in text_lower:
        m = re.search(r"\b(solo|couple|partner|friends|family)\b", text_lower)
        if m:
            return m.group(1)
        return ""
    if text_lower.startswith("i prefer:"):
        text = text[9:].strip()
    return text


def parse_natural_language_query(
    message: str,
    previous_prefs: Optional[dict] = None,
    region_lookup: Optional[dict] = None,
    direct_update: Optional[dict] = None
) -> Tuple[dict, List[dict], bool]:
    """Extracts structured preferences from natural language with strict state persistence.
    Returns: (extracted_preferences, structured_follow_ups, is_ambiguous)
    """
    clean_msg = sanitize_incoming_user_message(message)
    text = clean_msg.lower()

    # 1. Initialize from previous preferences (persistence across conversation turns)
    prefs: Dict[str, Any] = {}
    if previous_prefs:
        for k, v in previous_prefs.items():
            if v is not None and v != [] and v != "":
                if isinstance(v, list):
                    prefs[k] = list(v)
                else:
                    prefs[k] = v

    # 2. Apply direct update if supplied (e.g. from structured chip click)
    if direct_update:
        for k, v in direct_update.items():
            if v is not None:
                prefs[k] = v

    # If the user message is empty after sanitization and direct update was applied, proceed with current state
    if not text and direct_update:
        follow_ups, is_ambiguous = compute_follow_ups(prefs)
        return prefs, follow_ups, is_ambiguous

    # 3. Budget detection (canonical normalization)
    for b_level, words in BUDGET_KEYWORDS.items():
        # Match whole words or phrases (e.g. "on a budget", "low cost", "luxury")
        pattern = r"\b(" + "|".join(re.escape(w) for w in words) + r")\b"
        if re.search(pattern, text):
            prefs["budget_level"] = b_level
            break

    # 4. Companion detection (family_with_kids / family_with_parents checked before family)
    for comp, words in COMPANION_KEYWORDS.items():
        pattern = r"\b(" + "|".join(re.escape(w) for w in words) + r")\b"
        if re.search(pattern, text):
            prefs["companions"] = comp
            break

    # 5. Pace detection
    for pace, words in PACE_KEYWORDS.items():
        pattern = r"\b(" + "|".join(re.escape(w) for w in words) + r")\b"
        if re.search(pattern, text):
            prefs["travel_pace"] = pace
            break

    # 6. Duration detection
    dur_match = re.search(r"\b(\d+)\s*(?:to|-)\s*(\d+)\s*(?:days?|nights?)\b", text)
    if dur_match:
        prefs["duration_days"] = f"{dur_match.group(1)}-{dur_match.group(2)}"
    else:
        single_dur = re.search(r"\b(\d+)\s*(?:days?|nights?)\b", text)
        if single_dur:
            prefs["duration_days"] = int(single_dur.group(1))
        elif "a week" in text or "one week" in text or "7 days" in text:
            prefs["duration_days"] = 7
        elif "weekend" in text:
            prefs["duration_days"] = "2-3"

    # 7. Seasons & Months
    for month_name, m_num in MONTH_MAP.items():
        if re.search(rf"\b(?:in\s+)?{re.escape(month_name)}\b", text):
            prefs["travel_month"] = m_num
            break

    if "travel_month" not in prefs:
        for season, words in SEASONS_KEYWORDS.items():
            pattern = r"\b(" + "|".join(re.escape(w) for w in words) + r")\b"
            if re.search(pattern, text):
                prefs["travel_season"] = season
                break

    # 8. Themes & Interests
    # Only detect themes if the text contains explicit theme keywords
    detected_themes = set()
    for theme, words in THEME_KEYWORDS.items():
        pattern = r"\b(" + "|".join(re.escape(w) for w in words) + r")\b"
        if re.search(pattern, text):
            detected_themes.add(theme)

    if detected_themes:
        # Merge detected themes into user preferences
        existing_themes = set(prefs.get("interests", []))
        if prefs.get("travel_type"):
            existing_themes.add(prefs["travel_type"])

        all_themes = existing_themes.union(detected_themes)
        # Determine primary theme vs secondary interests
        theme_order = [t for t in ["adventure", "mountains", "beach", "relaxation", "wildlife", "nature", "culture", "spiritual", "city", "sightseeing"] if t in all_themes]
        if theme_order:
            prefs["travel_type"] = theme_order[0]
            prefs["interests"] = [t for t in theme_order if t != prefs["travel_type"]]
            if not prefs["interests"] and len(theme_order) == 1:
                prefs["interests"] = [theme_order[0]]

    # 9. Region & Country detection
    if re.search(r"\bindia\b|\bdomestic\b", text):
        prefs["region"] = "India"
    elif re.search(r"\beurope\b|\beuropean\b", text):
        prefs["region"] = "Europe"
    elif re.search(r"\binternational\b|\babroad\b|\bforeign\b", text):
        prefs["region"] = "International"
    elif region_lookup:
        for r_name in sorted(region_lookup.keys(), key=lambda x: -len(x)):
            if len(r_name) >= 4 and re.search(rf"\b{re.escape(r_name)}\b", text):
                prefs["region"] = region_lookup[r_name][1]
                break

    # Compute follow-up questions
    follow_ups, is_ambiguous = compute_follow_ups(prefs, clean_msg)
    return prefs, follow_ups, is_ambiguous


def compute_follow_ups(prefs: dict, raw_msg: str = "") -> Tuple[List[dict], bool]:
    """Generates structured follow-up questions with chip options for any missing preferences."""
    has_theme = bool(prefs.get("travel_type") or prefs.get("interests"))
    has_region = bool(prefs.get("region"))
    has_budget = bool(prefs.get("budget_level"))
    has_companion = bool(prefs.get("companions"))
    has_duration = bool(prefs.get("duration_days"))

    signals_count = sum([has_theme, has_region, has_budget, has_companion, has_duration])
    word_count = len(raw_msg.split()) if raw_msg else 10
    is_ambiguous = signals_count == 0 or (signals_count == 1 and word_count < 4)

    follow_ups: List[dict] = []

    # Priority 1: Destination vibe / Region
    if not has_region and not has_theme:
        follow_ups.append({
            "question": "Are you looking for trips in India or International?",
            "field": "region",
            "options": [
                {"label": "India", "value": "India"},
                {"label": "Europe", "value": "Europe"},
                {"label": "International", "value": "International"}
            ]
        })
        follow_ups.append({
            "question": "What type of travel experience do you prefer?",
            "field": "travel_type",
            "options": [
                {"label": "🏔️ Mountains", "value": "mountains"},
                {"label": "🏖️ Beach", "value": "beach"},
                {"label": "🧗 Adventure", "value": "adventure"},
                {"label": "🏰 Culture", "value": "culture"},
                {"label": "🌿 Wildlife", "value": "wildlife"}
            ]
        })
    # Priority 2: Budget
    elif not has_budget:
        follow_ups.append({
            "question": "What is your preferred budget range?",
            "field": "budget_level",
            "options": [
                {"label": "Budget (<$50/day)", "value": "budget"},
                {"label": "Moderate ($50–$130/day)", "value": "moderate"},
                {"label": "Luxury (>$130/day)", "value": "premium"}
            ]
        })
    # Priority 3: Companions
    elif not has_companion:
        follow_ups.append({
            "question": "Who will be traveling on this trip?",
            "field": "companions",
            "options": [
                {"label": "Solo", "value": "solo"},
                {"label": "Couple", "value": "couple"},
                {"label": "Friends", "value": "friends"},
                {"label": "Family", "value": "family"}
            ]
        })
    # Priority 4: Duration
    elif not has_duration:
        follow_ups.append({
            "question": "How many days are you planning for this trip?",
            "field": "duration_days",
            "options": [
                {"label": "Weekend (2-3 days)", "value": "2-3"},
                {"label": "4-5 days", "value": "5"},
                {"label": "1 week (7 days)", "value": "7"},
                {"label": "10+ days", "value": "10"}
            ]
        })

    return follow_ups, is_ambiguous
