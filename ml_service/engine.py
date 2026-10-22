import os
import re
import math
import html
from typing import Dict, List, Tuple, Any, Optional
from difflib import get_close_matches
from collections.abc import Mapping

import pandas as pd
import numpy as np

# ---------------------------------------------------------------------------
# Controlled vocabularies and constants (exact match with notebook)
# ---------------------------------------------------------------------------
SCORE_COLUMNS = [
    "adventure_score", "nature_score", "sightseeing_score", "relaxation_score", "wildlife_score",
    "beach_score", "culture_score", "family_friendliness_score", "accessibility_score",
]

THEME_SCORE_COLUMNS = [
    "adventure_score", "nature_score", "sightseeing_score", "relaxation_score",
    "wildlife_score", "beach_score", "culture_score"
]

REQUIRED_COLUMNS = [
    "destination_id", "destination_name", "country", "region", "subregion",
    "travel_categories", "budget_level", "estimated_daily_cost", "currency",
    "typical_duration_days", "best_seasons", "travel_pace", "suitable_companions",
    "recommended_activities", "destination_description"
] + SCORE_COLUMNS

VALID_CATEGORIES = {
    "adventure", "nature", "sightseeing", "relaxation", "wildlife",
    "beach", "culture", "spiritual", "city", "mountains"
}
VALID_SEASONS = {"winter", "spring", "summer", "autumn", "year_round"}
VALID_PACES = ["relaxed", "balanced", "fast"]
BUDGET_LEVELS = ["budget", "moderate", "premium"]
VALID_COMPANIONS = {"solo", "couple", "friends", "family"}
VALID_REGIONS = {"India", "International"}

THEMES = ["adventure", "nature", "sightseeing", "relaxation", "wildlife", "beach", "culture", "mountains", "spiritual", "city"]
THEME_TO_FEATURE = {
    "adventure": "adventure_score", "nature": "nature_score", "sightseeing": "sightseeing_score",
    "relaxation": "relaxation_score", "wildlife": "wildlife_score", "beach": "beach_score",
    "culture": "culture_score", "mountains": "cat_mountains", "spiritual": "cat_spiritual", "city": "cat_city",
}

# Fixed exchange rates (USD per 1 unit of currency)
ILLUSTRATIVE_USD_RATES = {
    "INR": 0.012, "USD": 1.0, "THB": 0.028, "IDR": 0.000062, "NPR": 0.0075, "SGD": 0.74, "EUR": 1.08,
    "GBP": 1.27, "CHF": 1.12, "ISK": 0.0072, "LKR": 0.0033, "AED": 0.272, "JPY": 0.0067, "VND": 0.00004,
    "NZD": 0.60, "TRY": 0.03,
}

BUDGET_BAND_MAX_USD = {"budget": 50.0, "moderate": 130.0}

def budget_level_from_usd(cost_usd: float) -> str:
    """Canonical budget band from illustrative USD daily cost."""
    if cost_usd < BUDGET_BAND_MAX_USD["budget"]:
        return "budget"
    if cost_usd <= BUDGET_BAND_MAX_USD["moderate"]:
        return "moderate"
    return "premium"

SCORING_WEIGHTS = {
    "theme_intensity": 0.28, "theme_profile": 0.12, "budget": 0.14, "duration": 0.10,
    "season": 0.08, "pace": 0.06, "companions": 0.12, "accessibility": 0.10
}
WEIGHT_KEY = {"overall_appeal": "theme_intensity"}
BUDGET_FIT = {-2: 0.70, -1: 0.85, 0: 1.0, 1: 0.40, 2: 0.0}
PACE_RANK = {"relaxed": 0, "balanced": 1, "fast": 2}
DEFAULT_DIVERSITY = 0.15

TRAVEL_TYPE_OPTIONS = THEMES
COMPANION_OPTIONS = ["solo", "couple", "friends", "family", "family_with_kids", "family_with_parents"]
SEASON_OPTIONS = ["winter", "spring", "summer", "autumn"]
COMFORT_OPTIONS = ["easy_access"]
QUESTION_IDS = [
    "travel_type", "companions", "budget_level", "duration_days", "region",
    "interests", "travel_pace", "travel_season", "travel_month", "comfort_needs"
]
FLEXIBLE_TOKENS = {
    "", "flexible", "any", "unknown", "not_sure", "no_preference", "none",
    "undecided", "dont_know", "anywhere", "worldwide"
}
THEME_ALIASES = {
    "cultural": "culture", "heritage": "culture", "relax": "relaxation",
    "relaxing": "relaxation", "beaches": "beach", "mountain": "mountains",
    "cities": "city", "animals": "wildlife", "safari": "wildlife", "history": "culture"
}
PACE_ALIASES = {
    "slow": "relaxed", "easy": "relaxed", "moderate": "balanced",
    "medium": "balanced", "packed": "fast", "busy": "fast"
}
COMPANION_ALIASES = {
    "alone": "solo", "partner": "couple", "friend": "friends",
    "family_with_children": "family_with_kids", "family_with_parent": "family_with_parents",
    "family_with_seniors": "family_with_parents"
}
BUDGET_ALIASES = {
    "low": "budget", "cheap": "budget", "mid": "moderate",
    "medium": "moderate", "mid_range": "moderate", "high": "premium", "luxury": "premium"
}
COMFORT_ALIASES = {
    "accessible": "easy_access", "accessibility": "easy_access", "low_effort": "easy_access"
}
MONTH_TO_SEASON = {
    12: "winter", 1: "winter", 2: "winter", 3: "spring", 4: "spring", 5: "spring",
    6: "summer", 7: "summer", 8: "summer", 9: "autumn", 10: "autumn", 11: "autumn"
}
TYPE_WEIGHT, INTEREST_WEIGHT = 1.0, 0.85


class PreferenceValidationError(ValueError):
    """Raised when questionnaire / preference inputs are invalid."""
    def __init__(self, errors):
        self.errors = list(errors)
        super().__init__("; ".join(self.errors))


class DataIntegrityError(ValueError):
    """Raised when dataset CSV fails validation checks."""
    pass


def clean_text(text: Optional[str]) -> str:
    """Decodes HTML entities and normalizes whitespace so text is clean plain-text."""
    if not text:
        return ""
    cleaned = html.unescape(text)
    cleaned = re.sub(r'&#x([0-9a-fA-F]+);', lambda m: chr(int(m.group(1), 16)), cleaned)
    cleaned = re.sub(r'&#([0-9]+);', lambda m: chr(int(m.group(1))), cleaned)
    return cleaned.strip()


def split_pipe(val: Any) -> List[str]:
    """Helper to split pipe-delimited values safely."""
    if pd.isna(val) or val is None:
        return []
    return [x.strip() for x in str(val).split("|") if x.strip()]


def _pref_token(value: Any) -> str:
    return re.sub(r"[\s\-]+", "_", str(value).strip().lower().replace("'", ""))


def _is_flexible(value: Any) -> bool:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return True
    if isinstance(value, (list, tuple, set)):
        return len(value) == 0
    return isinstance(value, str) and _pref_token(value) in FLEXIBLE_TOKENS


def _parse_duration(value: Any) -> Tuple[int, int]:
    """Return (min_days, max_days) from int, 'a-b' string, or [a, b] list."""
    if isinstance(value, bool):
        raise ValueError("duration_days must be a number or range, not a boolean")
    if isinstance(value, (int, np.integer)) or (isinstance(value, float) and value.is_integer()):
        low = high = int(value)
    elif isinstance(value, str):
        match = re.fullmatch(r"\s*(\d+)\s*(?:[-\u2013\u2014]|to)\s*(\d+)\s*(?:days?)?\s*|\s*(\d+)\s*(?:days?)?\s*", value)
        if not match:
            raise ValueError(f"duration_days '{value}' is not understood (use e.g. 5 or '4-7')")
        low, high = (int(match.group(1)), int(match.group(2))) if match.group(1) else (int(match.group(3)),) * 2
    elif isinstance(value, (list, tuple)) and len(value) == 2 and all(isinstance(v, (int, np.integer)) and not isinstance(v, bool) for v in value):
        low, high = int(value[0]), int(value[1])
    else:
        raise ValueError(f"duration_days must be an integer, a range like '4-7', or [min, max]; got {value!r}")
    if not (1 <= low <= high <= 60):
        raise ValueError(f"duration_days must satisfy 1 <= min <= max <= 60; got {low}-{high}")
    return low, high


def validate_preferences(raw: Any, region_lookup: Optional[dict] = None) -> Tuple[dict, List[str]]:
    """Validate and normalize preferences. Missing/flexible answers become None."""
    if not isinstance(raw, Mapping):
        raise PreferenceValidationError([f"preferences must be a JSON object / dict, got {type(raw).__name__}"])
    errors, warns = [], []
    unknown = sorted(set(raw) - set(QUESTION_IDS))
    if unknown:
        warns.append(f"Ignored unknown field(s): {unknown}")

    def single_choice(key, options, aliases=None):
        value = raw.get(key)
        if _is_flexible(value):
            return None
        if not isinstance(value, str):
            errors.append(f"{key} must be a string, got {type(value).__name__}")
            return None
        token = _pref_token(value)
        token = (aliases or {}).get(token, token)
        if token not in options:
            hint = get_close_matches(token, options, n=2)
            errors.append(f"{key} '{value}' is not valid; choose from {list(options)}" + (f" (did you mean {hint}?)" if hint else ""))
            return None
        return token

    def multi_choice(key, options, aliases=None):
        value = raw.get(key)
        if _is_flexible(value):
            return []
        items = [p for p in value.split(",")] if isinstance(value, str) else list(value) if isinstance(value, (list, tuple, set)) else None
        if items is None:
            errors.append(f"{key} must be a list of strings, got {type(value).__name__}")
            return []
        chosen = []
        for item in items:
            if not isinstance(item, str):
                errors.append(f"{key} contains a non-string entry: {item!r}")
                continue
            token = _pref_token(item)
            if token in FLEXIBLE_TOKENS:
                continue
            token = (aliases or {}).get(token, token)
            if token not in options:
                errors.append(f"{key} entry '{item}' is not valid; choose from {list(options)}")
            elif token not in chosen:
                chosen.append(token)
        return chosen

    prefs = {
        "travel_type": single_choice("travel_type", TRAVEL_TYPE_OPTIONS, THEME_ALIASES),
        "companions": single_choice("companions", COMPANION_OPTIONS, COMPANION_ALIASES),
        "budget_level": single_choice("budget_level", BUDGET_LEVELS, BUDGET_ALIASES),
        "travel_pace": single_choice("travel_pace", VALID_PACES, PACE_ALIASES),
        "interests": multi_choice("interests", THEMES, THEME_ALIASES),
        "comfort_needs": multi_choice("comfort_needs", COMFORT_OPTIONS, COMFORT_ALIASES),
        "duration_min": None, "duration_max": None, "region": None, "season": None,
    }

    if not _is_flexible(raw.get("duration_days")):
        try:
            prefs["duration_min"], prefs["duration_max"] = _parse_duration(raw["duration_days"])
        except ValueError as exc:
            errors.append(str(exc))

    region_value = raw.get("region")
    if not _is_flexible(region_value):
        if not isinstance(region_value, str):
            errors.append(f"region must be a string, got {type(region_value).__name__}")
        else:
            normalized_region = region_value.strip().lower()
            if normalized_region == "europe":
                prefs["region"] = {"kind": "broad_region", "value": "Europe"}
            elif region_lookup and normalized_region in region_lookup:
                kind, canonical = region_lookup[normalized_region]
                prefs["region"] = {"kind": kind, "value": canonical}
            else:
                if region_lookup:
                    hint = get_close_matches(normalized_region, list(region_lookup), n=3)
                    errors.append(f"region '{region_value}' is not in catalog" + (f" (did you mean {[region_lookup[h][1] for h in hint]}?)" if hint else ""))
                else:
                    prefs["region"] = {"kind": "region", "value": region_value}

    season = single_choice("travel_season", SEASON_OPTIONS)
    month_value = raw.get("travel_month")
    month_season = None
    if not _is_flexible(month_value):
        if isinstance(month_value, bool) or not isinstance(month_value, (int, np.integer)) or not 1 <= int(month_value) <= 12:
            errors.append(f"travel_month must be an integer 1-12, got {month_value!r}")
        else:
            month_season = MONTH_TO_SEASON[int(month_value)]
    if season and month_season and season != month_season:
        warns.append(f"travel_season '{season}' and travel_month {month_value} disagree; using travel_season")
    prefs["season"] = season or month_season

    if errors:
        raise PreferenceValidationError(errors)
    if all(v in (None, []) for v in prefs.values()):
        warns.append("No specific preferences provided; returning broadly appealing destinations.")
    return prefs, warns


def build_user_theme_vector(prefs: dict) -> pd.Series:
    """Convert user travel type and interests into a 10-d theme vector."""
    vector = pd.Series(0.0, index=THEMES)
    if prefs.get("travel_type") and prefs["travel_type"] in vector.index:
        vector[prefs["travel_type"]] = TYPE_WEIGHT
    for interest in prefs.get("interests", []):
        if interest in vector.index:
            vector[interest] = max(vector[interest], INTEREST_WEIGHT)
    return vector


class TravelRecommendationEngine:
    """Production wrapper for TravelSync Recommendation logic directly extracted from notebook."""

    def __init__(self, csv_path: Optional[str] = None):
        self.csv_path = csv_path or os.getenv("TRAVELSYNC_CSV_PATH", "ML/travelsync_destin.original.csv")
        self.df: Optional[pd.DataFrame] = None
        self.region_lookup: Dict[str, Tuple[str, str]] = {}
        self.theme_matrix: Optional[pd.DataFrame] = None
        self.load_dataset(self.csv_path)

    def load_dataset(self, path: str):
        """Loads and precomputes destination features with strict data integrity checks."""
        resolved_path = None
        candidates = [
            path,
            os.path.abspath(path) if path else None,
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", path)) if path else None,
            os.path.abspath(os.path.join(os.path.dirname(__file__), path)) if path else None,
            os.path.abspath(os.path.join(os.getcwd(), path)) if path else None,
        ]
        for cand in candidates:
            if cand and os.path.exists(cand) and os.path.isfile(cand):
                resolved_path = cand
                break

        if not resolved_path:
            raise FileNotFoundError(f"Destination CSV not found at '{path}'. Checked candidate paths: {[c for c in candidates if c][:3]}")

        path = resolved_path
        df = pd.read_csv(path)
        if df.empty:
            raise DataIntegrityError("Destination catalog CSV is empty.")

        missing_cols = set(REQUIRED_COLUMNS) - set(df.columns)
        if missing_cols:
            raise DataIntegrityError(f"Missing required columns in dataset: {sorted(missing_cols)}")

        for col in SCORE_COLUMNS:
            if not np.issubdtype(df[col].dtype, np.number):
                raise DataIntegrityError(f"Score column {col} contains non-numeric values.")
            if (df[col] < 0).any() or (df[col] > 10).any():
                raise DataIntegrityError(f"Score column {col} has values outside [0, 10].")

        df = df.copy()
        for curr in df["currency"].unique():
            if curr not in ILLUSTRATIVE_USD_RATES:
                raise DataIntegrityError(f"Unsupported currency '{curr}' found in dataset.")

        # Compute USD daily cost and canonical budget rank using single source of truth
        df["estimated_daily_cost_usd"] = df.apply(
            lambda r: r["estimated_daily_cost"] * ILLUSTRATIVE_USD_RATES[r["currency"]], axis=1
        )
        df["budget_tier"] = df["estimated_daily_cost_usd"].map(budget_level_from_usd)
        df["budget_rank"] = df["budget_tier"].map({b: i for i, b in enumerate(BUDGET_LEVELS)})
        if df["budget_rank"].isna().any():
            raise DataIntegrityError("Found invalid budget_level values in dataset.")

        # Build theme matrix
        theme_dict = {}
        for t in ["adventure", "nature", "sightseeing", "relaxation", "wildlife", "beach", "culture"]:
            theme_dict[t] = (df[f"{t}_score"] / 10.0).values

        for t in ["mountains", "spiritual", "city"]:
            theme_dict[t] = df["travel_categories"].map(lambda cats: 1.0 if t in split_pipe(cats) else 0.0).values

        self.theme_matrix = pd.DataFrame(theme_dict, index=df["destination_id"].values)

        # Build region lookup
        self.region_lookup = {}
        for kind, column in [("subregion", "subregion"), ("country", "country"), ("region", "region")]:
            for value in df[column].dropna().unique():
                self.region_lookup[str(value).strip().lower()] = (kind, str(value))

        self.df = df
        self.csv_path = path

    def score(self, prefs: dict) -> pd.DataFrame:
        """Score every destination according to user preferences."""
        d = self.df.set_index("destination_id", drop=False)
        theme = self.theme_matrix.loc[d.index]
        comps = {}

        weights = build_user_theme_vector(prefs)
        wanted = weights[weights > 0]
        if len(wanted):
            comps["theme_intensity"] = (theme[wanted.index] * wanted).sum(axis=1) / wanted.sum()
            norms = np.linalg.norm(theme.to_numpy(), axis=1) * np.linalg.norm(weights.to_numpy())
            dots = theme.to_numpy() @ weights.to_numpy()
            comps["theme_profile"] = pd.Series(
                np.divide(dots, norms, out=np.zeros(len(d)), where=norms > 0),
                index=d.index
            )
        else:
            top3 = np.sort(d[THEME_SCORE_COLUMNS].to_numpy(dtype=float), axis=1)[:, -3:].mean(axis=1) / 10.0
            comps["overall_appeal"] = pd.Series(top3, index=d.index)

        diff = None
        if prefs["budget_level"]:
            diff = d["budget_rank"] - BUDGET_LEVELS.index(prefs["budget_level"])
            comps["budget"] = diff.map(BUDGET_FIT).astype(float)

        if prefs["duration_min"] is not None:
            typical = d["typical_duration_days"].to_numpy(dtype=float)
            lo, hi = prefs["duration_min"], prefs["duration_max"]
            needs_more = np.clip(typical - hi, 0, None)
            spare = np.clip(lo - typical, 0, None)
            comps["duration"] = pd.Series(np.clip(1 - 1.5 * needs_more / typical - 0.5 * spare / lo, 0, 1), index=d.index)

        if prefs["season"]:
            in_season = d["best_seasons"].map(lambda v: prefs["season"] in split_pipe(v) or "year_round" in split_pipe(v))
            comps["season"] = in_season.map({True: 1.0, False: 0.1}).astype(float)

        if prefs["travel_pace"]:
            gap = (d["travel_pace"].map(PACE_RANK) - PACE_RANK[prefs["travel_pace"]]).abs()
            comps["pace"] = 1.0 - 0.5 * gap

        if prefs["companions"]:
            is_family = prefs["companions"].startswith("family")
            label = "family" if is_family else prefs["companions"]
            suitable = d["suitable_companions"].map(lambda v: label in split_pipe(v)).map({True: 1.0, False: 0.25}).astype(float)
            comps["companions"] = 0.5 * suitable + 0.5 * d["family_friendliness_score"] / 10.0 if is_family else suitable

        if "easy_access" in prefs["comfort_needs"] or prefs["companions"] == "family_with_parents":
            comps["accessibility"] = d["accessibility_score"] / 10.0

        comp_df = pd.DataFrame(comps)
        active = pd.Series({c: SCORING_WEIGHTS[WEIGHT_KEY.get(c, c)] for c in comp_df.columns})
        active = active / active.sum()
        comp_df["final_score"] = (comp_df[active.index] * active).sum(axis=1)

        # 1. Geographic / Region filtering
        region = prefs["region"]
        if region is None:
            geo_eligible = pd.Series(True, index=d.index)
        elif region["kind"] == "broad_region" and region["value"] == "Europe":
            geo_eligible = d["subregion"].str.lower().str.contains("europe", na=False)
        else:
            geo_eligible = (d[region["kind"]] == region["value"])

        # 2. Strict Budget policy:
        # A destination that is 2 tiers above user's budget (e.g. Premium tier when user requested Budget)
        # must NEVER be marked as an eligible primary match.
        if prefs["budget_level"] == "budget":
            budget_eligible = (diff <= 0)  # Only actual budget destinations
        elif prefs["budget_level"] == "moderate":
            budget_eligible = (diff <= 0)  # Budget and moderate are within moderate budget
        else:
            budget_eligible = pd.Series(True, index=d.index)

        # Primary eligibility requires both geography and budget match
        comp_df["geo_eligible"] = geo_eligible
        comp_df["budget_eligible"] = budget_eligible
        comp_df["eligible"] = geo_eligible & budget_eligible

        comp_df.attrs["weights"] = active.to_dict()
        return comp_df

    def select_top(self, scored: pd.DataFrame, top_n: int = 5, diversity: float = DEFAULT_DIVERSITY, eligible_col: str = "eligible", min_score: float = 30.0) -> List[str]:
        """MMR diversification matching the notebook, honoring hard constraints."""
        d = self.df.set_index("destination_id", drop=False)
        names = d["destination_name"]
        mask = scored[eligible_col] & (scored["final_score"] >= (min_score / 100.0))
        pool = scored.loc[mask, ["final_score"]].assign(name=names.loc[scored.index[mask]])
        pool = pool.sort_values(["final_score", "name"], ascending=[False, True])
        ids = list(pool.index)
        if diversity <= 0 or len(ids) <= 1:
            return ids[:top_n]
        vectors = self.theme_matrix.loc[ids].to_numpy()
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        unit = np.divide(vectors, norms, out=np.zeros_like(vectors), where=norms > 0)
        relevance = pool["final_score"].to_numpy()
        chosen, remaining = [0], list(range(1, len(ids)))
        while len(chosen) < min(top_n, len(ids)):
            max_sim = (unit[remaining] @ unit[chosen].T).max(axis=1)
            mmr = (1 - diversity) * relevance[remaining] - diversity * max_sim
            pick = remaining[int(np.argmax(mmr))]
            chosen.append(pick)
            remaining.remove(pick)
        return [ids[i] for i in chosen]

    def explain(self, dest: pd.Series, comp: pd.Series, prefs: dict, theme_row: pd.Series) -> Tuple[str, str]:
        """Deterministic, grounded explanation generator with HTML entity cleaning and no duplicate phrases."""
        reasons, trade = [], []
        seasons = split_pipe(dest["best_seasons"])
        usd = f"~US${dest['estimated_daily_cost_usd']:,.0f}/day"

        weights = build_user_theme_vector(prefs)
        strong, tagged, weak = [], [], []
        for theme in weights[weights > 0].sort_values(ascending=False, kind="stable").index:
            if theme in ("mountains", "spiritual", "city"):
                (tagged if theme_row[theme] > 0 else weak).append((theme, None))
            else:
                score = int(round(theme_row[theme] * 10))
                if score >= 6:
                    strong.append((theme, score))
                elif score <= 4:
                    weak.append((theme, score))
        if strong:
            reasons.append("it rates " + ", ".join(f"{s}/10 for {t}" for t, s in strong))
        if tagged:
            reasons.append("it is tagged as " + " and ".join(t for t, _ in tagged))
        for theme, score in weak:
            trade.append(f"limited {theme} appeal ({score}/10)" if score is not None else f"not tagged as a {theme} destination")
        if not len(weights[weights > 0]):
            top = theme_row[["adventure", "nature", "sightseeing", "relaxation", "wildlife", "beach", "culture"]].sort_values(ascending=False, kind="stable").head(3)
            reasons.append("it is broadly well-rounded, strongest on " + ", ".join(f"{t} ({int(round(v * 10))}/10)" for t, v in top.items()))

        # Budget explanation: avoid duplicate "budget budget"
        if prefs.get("budget_level"):
            user_b = prefs["budget_level"]
            dest_b = dest["budget_level"]
            gap = int(dest["budget_rank"]) - BUDGET_LEVELS.index(user_b)
            user_budget_phrase = "budget" if user_b == "budget" else f"{user_b} budget"
            if gap <= 0:
                reasons.append(f"its estimated cost ({usd}, {dest_b} band) fits your {user_budget_phrase}")
            else:
                trade.append(f"likely above your {user_budget_phrase} ({usd}, {dest_b} band)")

        # Duration
        if prefs.get("duration_min") is not None:
            lo, hi, typical = prefs["duration_min"], prefs["duration_max"], int(dest["typical_duration_days"])
            trip = f"{lo}" if lo == hi else f"{lo}-{hi}"
            if lo <= typical <= hi:
                reasons.append(f"your {trip}-day trip fits its typical {typical}-day visit")
            elif typical > hi:
                trade.append(f"it typically needs about {typical} days, more than the {trip} you have")
            else:
                trade.append(f"it typically takes about {typical} days, so you may have time to spare")

        # Season
        if prefs.get("season"):
            if comp.get("season", 0) >= 1.0:
                reasons.append(f"{prefs['season']} is among its best seasons")
            else:
                trade.append(f"{prefs['season']} is not among its listed best seasons (best: {', '.join(seasons)})")

        # Pace
        if prefs.get("travel_pace"):
            if dest["travel_pace"] == prefs["travel_pace"]:
                reasons.append(f"its typical pace ({dest['travel_pace']}) matches yours")
            else:
                trade.append(f"its typical pace is {dest['travel_pace']} while you prefer {prefs['travel_pace']}")

        # Companions
        if prefs.get("companions"):
            is_family = prefs["companions"].startswith("family")
            label = "family" if is_family else prefs["companions"]
            if label in split_pipe(dest["suitable_companions"]):
                extra = f" (family-friendliness {int(dest['family_friendliness_score'])}/10)" if label == "family" else ""
                reasons.append(f"it is marked suitable for {label} travel{extra}")
            else:
                trade.append(f"it is not marked as especially suited to {label} travel")

        raw_exp = "; ".join(reasons).capitalize() if reasons else "Good general fit."
        raw_trade = "; ".join(trade).capitalize() if trade else "None notable."

        # Guarantee plain text with zero HTML entity codes
        return clean_text(raw_exp), clean_text(raw_trade)

    def recommend(self, raw_preferences: dict, top_n: int = 5, diversity: float = DEFAULT_DIVERSITY, allow_alternatives: bool = True) -> Tuple[List[dict], dict, List[str], dict]:
        """Main entry point. Returns (recommendation_cards, validated_prefs, warnings, weights)."""
        prefs, warns = validate_preferences(raw_preferences, region_lookup=self.region_lookup)
        scored = self.score(prefs)
        d = self.df.set_index("destination_id", drop=False)
        eligible_df = d.loc[scored["eligible"]]

        recs = []
        region_name = prefs["region"]["value"] if prefs.get("region") else None

        # Check if primary budget filter eliminated all options in the requested region
        if len(eligible_df) == 0:
            if prefs.get("budget_level") and prefs.get("region"):
                warn_msg = f"No destinations in {region_name} matched your {prefs['budget_level']} budget tier."
                warns.append(warn_msg)

                # If allow_alternatives is enabled, provide the top geo-matching alternatives clearly flagged
                geo_df = d.loc[scored["geo_eligible"]]
                if not geo_df.empty and allow_alternatives:
                    alt_ids = self.select_top(scored, top_n=top_n, diversity=diversity, eligible_col="geo_eligible")
                    for idx, dest_id in enumerate(alt_ids, start=1):
                        dest_row = geo_df.loc[dest_id]
                        comp_row = scored.loc[dest_id]
                        theme_row = self.theme_matrix.loc[dest_id]
                        exp, trade = self.explain(dest_row, comp_row, prefs, theme_row)
                        usd_cost = dest_row["estimated_daily_cost_usd"]
                        budget_str = f"{dest_row['currency']} {dest_row['estimated_daily_cost']:,.0f}/day (~US${usd_cost:,.0f}; {dest_row['budget_level']} band, illustrative)"

                        recs.append({
                            "rank": idx,
                            "destination_id": dest_id,
                            "destination": clean_text(dest_row["destination_name"]),
                            "country": clean_text(dest_row["country"]),
                            "region": clean_text(dest_row["region"]),
                            "subregion": clean_text(dest_row["subregion"]),
                            "match_score": round(comp_row["final_score"] * 100, 1),
                            "budget_level": dest_row["budget_level"],
                            "estimated_daily_cost": float(dest_row["estimated_daily_cost"]),
                            "currency": dest_row["currency"],
                            "estimated_daily_cost_usd": round(float(usd_cost), 1),
                            "estimated_budget": budget_str,
                            "suggested_duration": f"about {dest_row['typical_duration_days']} days",
                            "suitable_activities": clean_text(dest_row["recommended_activities"].replace("|", "; ")),
                            "best_seasons": split_pipe(dest_row["best_seasons"]),
                            "travel_pace": dest_row["travel_pace"],
                            "suitable_companions": split_pipe(dest_row["suitable_companions"]),
                            "explanation": exp,
                            "trade_offs": trade,
                            "destination_description": clean_text(dest_row["destination_description"]),
                            "is_alternative": True
                        })
                    return recs, prefs, warns, scored.attrs.get("weights", {})
            else:
                warns.append("No destinations matched your criteria.")
                return [], prefs, warns, scored.attrs.get("weights", {})

        top_ids = self.select_top(scored, top_n=top_n, diversity=diversity, eligible_col="eligible")
        if len(top_ids) < top_n and len(top_ids) > 0:
            warns.append(f"Found {len(top_ids)} destination(s) that match your criteria.")

        for idx, dest_id in enumerate(top_ids, start=1):
            dest_row = eligible_df.loc[dest_id]
            comp_row = scored.loc[dest_id]
            theme_row = self.theme_matrix.loc[dest_id]
            exp, trade = self.explain(dest_row, comp_row, prefs, theme_row)

            usd_cost = dest_row["estimated_daily_cost_usd"]
            budget_str = f"{dest_row['currency']} {dest_row['estimated_daily_cost']:,.0f}/day (~US${usd_cost:,.0f}; {dest_row['budget_level']} band, illustrative)"

            recs.append({
                "rank": idx,
                "destination_id": dest_id,
                "destination": clean_text(dest_row["destination_name"]),
                "country": clean_text(dest_row["country"]),
                "region": clean_text(dest_row["region"]),
                "subregion": clean_text(dest_row["subregion"]),
                "match_score": round(comp_row["final_score"] * 100, 1),
                "budget_level": dest_row["budget_level"],
                "estimated_daily_cost": float(dest_row["estimated_daily_cost"]),
                "currency": dest_row["currency"],
                "estimated_daily_cost_usd": round(float(usd_cost), 1),
                "estimated_budget": budget_str,
                "suggested_duration": f"about {dest_row['typical_duration_days']} days",
                "suitable_activities": clean_text(dest_row["recommended_activities"].replace("|", "; ")),
                "best_seasons": split_pipe(dest_row["best_seasons"]),
                "travel_pace": dest_row["travel_pace"],
                "suitable_companions": split_pipe(dest_row["suitable_companions"]),
                "explanation": exp,
                "trade_offs": trade,
                "destination_description": clean_text(dest_row["destination_description"]),
                "is_alternative": False
            })

        return recs, prefs, warns, scored.attrs.get("weights", {})
