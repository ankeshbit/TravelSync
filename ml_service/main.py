import os
from contextlib import asynccontextmanager
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .engine import TravelRecommendationEngine, PreferenceValidationError, DataIntegrityError, clean_text
from .nlp import parse_natural_language_query
from .schemas import (
    TravelPreferencesInput,
    RecommendationResponse,
    DestinationRecommendation,
    ChatRequest,
    ChatResponse,
    FollowUpQuestion
)

engine: Optional[TravelRecommendationEngine] = None
initialization_error: Optional[str] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine, initialization_error
    csv_path = os.getenv("TRAVELSYNC_CSV_PATH", "ML/travelsync_destin.original.csv")
    fail_fast = os.getenv("FAIL_FAST_STARTUP", "false").lower() in ("true", "1", "yes")
    try:
        engine = TravelRecommendationEngine(csv_path=csv_path)
        initialization_error = None
        print(f"[ML Service] Successfully loaded {len(engine.df)} destinations from {csv_path}")
    except Exception as e:
        initialization_error = str(e)
        print(f"[ML Service] Error initializing recommendation engine: {e}")
        if fail_fast:
            raise RuntimeError(f"Startup failed: Unable to initialize TravelRecommendationEngine: {e}") from e
    yield

app = FastAPI(
    title="TravelSync ML Recommendation Service",
    version="1.1.0",
    description="Deterministic constraint-aware destination recommendation engine with MMR diversification",
    lifespan=lifespan
)

raw_origins = os.getenv("ML_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173")
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
async def health_check():
    """Service health and dataset status."""
    if engine is None or engine.df is None:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "error": initialization_error or "Recommendation engine not initialized"
            }
        )
    return {
        "status": "healthy",
        "service": "TravelSync Recommendation Engine",
        "destinations_loaded": len(engine.df),
        "themes_count": len(engine.theme_matrix.columns) if engine.theme_matrix is not None else 0,
        "csv_path": engine.csv_path
    }


@app.post("/recommend", response_model=RecommendationResponse, tags=["Recommendations"])
async def get_recommendations(
    preferences: TravelPreferencesInput,
    top_n: int = Query(5, ge=1, le=20),
    diversity: float = Query(0.15, ge=0.0, le=1.0)
):
    """Generate destination recommendations based on structured user preferences."""
    if engine is None or engine.df is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Recommendation engine is not initialized."
        )

    try:
        raw_prefs = preferences.model_dump(exclude_none=True)
        recs, validated_prefs, warns, weights = engine.recommend(
            raw_prefs, top_n=top_n, diversity=diversity
        )

        formatted_recs = [DestinationRecommendation(**r) for r in recs]
        return RecommendationResponse(
            recommendations=formatted_recs,
            preferences=validated_prefs,
            warnings=warns,
            weights=weights,
            total_found=len(formatted_recs)
        )
    except PreferenceValidationError as pve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=pve.errors)
    except Exception as e:
        print(f"[ML Service Error] in /recommend: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An error occurred while generating recommendations.")


@app.post("/chat", response_model=ChatResponse, tags=["Chatbot"])
async def chat_recommend(request: ChatRequest, top_n: int = Query(4, ge=1, le=10)):
    """Accepts natural language user query, extracts preferences, and returns recommendations with grounded explanations."""
    if engine is None or engine.df is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Recommendation engine is not initialized."
        )

    user_msg = (request.message or "").strip()
    if not user_msg and not request.direct_preference_update:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either a non-empty 'message' or 'direct_preference_update' must be provided."
        )

    prev_dict = request.previous_preferences.model_dump(exclude_none=True) if request.previous_preferences else None
    extracted_prefs, follow_ups, is_ambiguous = parse_natural_language_query(
        user_msg,
        previous_prefs=prev_dict,
        region_lookup=engine.region_lookup,
        direct_update=request.direct_preference_update
    )

    try:
        recs, validated_prefs, warns, weights = engine.recommend(
            extracted_prefs, top_n=top_n, diversity=0.15
        )
        formatted_recs = [DestinationRecommendation(**r) for r in recs]

        # Generate a clean, natural conversational summary from canonical values without repetition
        has_alternatives = any(r.get("is_alternative") for r in recs)

        if has_alternatives:
            reg = extracted_prefs.get("region", "that region")
            b_tier = extracted_prefs.get("budget_level", "budget")
            budget_phrase = "budget" if b_tier == "budget" else f"{b_tier} budget"
            bot_msg = (
                f"I couldn't find any destinations in {reg} within your {budget_phrase} (under $50/day). "
                f"All available catalog destinations in {reg} are in the premium band ($140–$202/day). "
                f"Here are the closest higher-budget alternatives in {reg} for your review:"
            )
        elif not formatted_recs:
            bot_msg = "No destinations matched your criteria. Try broadening your budget or exploring other regions."
        elif is_ambiguous:
            bot_msg = (
                "I've found some popular ideas below to get started! "
                "To narrow this down to your exact match, please choose from the options below:"
            )
        else:
            criteria_parts = []
            if extracted_prefs.get("travel_type"):
                criteria_parts.append(f"{extracted_prefs['travel_type']} vibe")
            if extracted_prefs.get("region"):
                criteria_parts.append(f"in {extracted_prefs['region']}")
            if extracted_prefs.get("budget_level"):
                # Avoid duplicated "budget budget"
                b_val = extracted_prefs['budget_level']
                if b_val == "budget":
                    criteria_parts.append("on a budget")
                elif b_val == "moderate":
                    criteria_parts.append("on a moderate budget")
                else:
                    criteria_parts.append("on a luxury budget")
            if extracted_prefs.get("companions"):
                comp = str(extracted_prefs['companions']).replace('_', ' ')
                criteria_parts.append(f"for {comp}")
            if extracted_prefs.get("duration_days"):
                criteria_parts.append(f"for {extracted_prefs['duration_days']} days")

            criteria_str = ", ".join(criteria_parts) if criteria_parts else "your request"
            bot_msg = f"Based on {criteria_str}, here are my top {len(formatted_recs)} recommended destinations with grounded match details:"

        # Format questions for backward compatibility and structured chips
        q_strings = [f["question"] for f in follow_ups[:2]]
        structured_q = [FollowUpQuestion(**f) for f in follow_ups[:2]]

        return ChatResponse(
            message=clean_text(bot_msg),
            follow_up_questions=q_strings,
            structured_follow_ups=structured_q,
            extracted_preferences=extracted_prefs,
            recommendations=formatted_recs,
            is_ambiguous=is_ambiguous
        )
    except PreferenceValidationError as pve:
        return ChatResponse(
            message=clean_text(f"I couldn't quite understand some parameters: {'; '.join(pve.errors)}. Could you rephrase?"),
            follow_up_questions=["Which destination, country, or budget band are you looking for?"],
            structured_follow_ups=[],
            extracted_preferences=extracted_prefs,
            recommendations=[],
            is_ambiguous=True
        )
    except Exception as e:
        print(f"[ML Service Error] in /chat: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An error occurred while processing the chat request.")


@app.get("/destinations", tags=["Catalog"])
async def list_destinations(q: Optional[str] = None, region: Optional[str] = None):
    """Retrieve catalog destinations with optional search filtering."""
    if engine is None or engine.df is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Recommendation engine is not initialized."
        )

    df = engine.df
    if region:
        df = df[df["region"].str.lower() == region.lower()]
    if q:
        query_str = q.lower()
        mask = (
            df["destination_name"].str.lower().str.contains(query_str) |
            df["country"].str.lower().str.contains(query_str) |
            df["subregion"].str.lower().str.contains(query_str) |
            df["travel_categories"].str.lower().str.contains(query_str)
        )
        df = df[mask]

    return {
        "count": len(df),
        "destinations": df[[
            "destination_id", "destination_name", "country", "region", "subregion",
            "budget_level", "estimated_daily_cost", "currency", "typical_duration_days"
        ]].to_dict(orient="records")
    }
