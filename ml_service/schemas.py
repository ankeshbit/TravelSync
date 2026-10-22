from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field

class TravelPreferencesInput(BaseModel):
    travel_type: Optional[str] = Field(None, max_length=50, description="Primary theme: adventure, nature, sightseeing, relaxation, wildlife, beach, culture, spiritual, city, mountains")
    companions: Optional[str] = Field(None, max_length=50, description="solo, couple, friends, family, family_with_kids, family_with_parents")
    budget_level: Optional[str] = Field(None, max_length=50, description="budget, moderate, premium")
    duration_days: Optional[Union[int, str, List[int]]] = Field(None, description="Number of days, range e.g. '4-7', or [4, 7]")
    region: Optional[str] = Field(None, max_length=100, description="India, International, Europe, Southeast Asia, or specific country/subregion")
    interests: Optional[List[str]] = Field(default_factory=list, max_length=20, description="List of interests / themes")
    travel_pace: Optional[str] = Field(None, max_length=50, description="relaxed, balanced, fast")
    travel_season: Optional[str] = Field(None, max_length=50, description="winter, spring, summer, autumn")
    travel_month: Optional[int] = Field(None, ge=1, le=12, description="Month 1-12")
    comfort_needs: Optional[List[str]] = Field(default_factory=list, max_length=10, description="e.g. ['easy_access']")

class DestinationRecommendation(BaseModel):
    rank: int
    destination_id: str
    destination: str
    country: str
    region: str
    subregion: str
    match_score: float
    budget_level: str
    estimated_daily_cost: float
    currency: str
    estimated_daily_cost_usd: float
    estimated_budget: str
    suggested_duration: str
    suitable_activities: str
    best_seasons: List[str]
    travel_pace: str
    suitable_companions: List[str]
    explanation: str
    trade_offs: str
    destination_description: str
    is_alternative: bool = False

class RecommendationResponse(BaseModel):
    recommendations: List[DestinationRecommendation]
    preferences: Dict[str, Any]
    warnings: List[str]
    weights: Dict[str, float]
    total_found: int

class FollowUpOption(BaseModel):
    label: str
    value: str

class FollowUpQuestion(BaseModel):
    question: str
    field: str
    options: List[FollowUpOption] = Field(default_factory=list)

class ChatRequest(BaseModel):
    message: Optional[str] = Field(default="", max_length=1000, description="Natural language travel query from user")
    previous_preferences: Optional[TravelPreferencesInput] = Field(None, description="Preferences carried over from previous turns")
    direct_preference_update: Optional[Dict[str, Any]] = Field(None, description="Direct preference key-value pair from follow-up chips")

class ChatResponse(BaseModel):
    message: str
    follow_up_questions: List[str] = Field(default_factory=list)
    structured_follow_ups: List[FollowUpQuestion] = Field(default_factory=list)
    extracted_preferences: Dict[str, Any]
    recommendations: List[DestinationRecommendation] = Field(default_factory=list)
    is_ambiguous: bool = False
