import pytest
from fastapi.testclient import TestClient
from ml_service.main import app

client = TestClient(app)

def test_health_endpoint():
    """Verify health endpoint returns 200 with loaded destinations info."""
    with TestClient(app) as test_client:
        response = test_client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["destinations_loaded"] == 41

def test_recommend_endpoint_valid():
    """Verify recommendation endpoint returns recommendations with grounded explanations."""
    with TestClient(app) as test_client:
        payload = {
            "travel_type": "beach",
            "budget_level": "moderate",
            "companions": "couple",
            "duration_days": 5,
            "region": "India"
        }
        response = test_client.post("/recommend?top_n=3", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "recommendations" in data
        assert len(data["recommendations"]) == 3
        top_dest = data["recommendations"][0]
        assert top_dest["destination"]
        assert top_dest["match_score"] > 0
        assert "explanation" in top_dest
        assert "trade_offs" in top_dest

def test_recommend_endpoint_invalid_budget():
    """Verify that an invalid budget returns a 400 Bad Request with details."""
    with TestClient(app) as test_client:
        payload = {
            "budget_level": "nonexistent_budget"
        }
        response = test_client.post("/recommend", json=payload)
        assert response.status_code == 400
        assert "budget_level" in response.text

def test_chat_endpoint_natural_language():
    """Verify chat endpoint parses query and returns recommendations with follow-ups."""
    with TestClient(app) as test_client:
        payload = {
            "message": "I want a budget cultural trip in India with family for 4 days"
        }
        response = test_client.post("/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "recommendations" in data
        assert len(data["recommendations"]) > 0
        assert data["extracted_preferences"]["region"] == "India"
        assert data["extracted_preferences"]["budget_level"] == "budget"

def test_destinations_catalog_endpoint():
    """Verify destinations catalog endpoint supports text filtering."""
    with TestClient(app) as test_client:
        response = test_client.get("/destinations?q=Goa")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] >= 1
        assert any(d["destination_name"] == "Goa" for d in data["destinations"])
