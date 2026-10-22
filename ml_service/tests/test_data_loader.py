import os
import tempfile
import pandas as pd
import pytest

from ml_service.engine import (
    TravelRecommendationEngine,
    DataIntegrityError,
    REQUIRED_COLUMNS
)

def test_load_real_catalog():
    """Verify that the production CSV loads successfully with expected schema and rows."""
    engine = TravelRecommendationEngine()
    assert engine.df is not None
    assert len(engine.df) == 41
    assert all(col in engine.df.columns for col in REQUIRED_COLUMNS)
    assert engine.theme_matrix is not None
    assert engine.theme_matrix.shape == (41, 10)
    assert not engine.df.isnull().values.any()

def test_missing_file_error():
    """Verify that a nonexistent CSV file raises FileNotFoundError."""
    with pytest.raises(FileNotFoundError):
        TravelRecommendationEngine(csv_path="nonexistent_folder/missing_file.csv")

def test_empty_dataset_error():
    """Verify that an empty CSV raises DataIntegrityError."""
    with tempfile.NamedTemporaryFile(suffix=".csv", mode="w", delete=False) as f:
        f.write(",".join(REQUIRED_COLUMNS) + "\n")
        temp_path = f.name

    try:
        with pytest.raises(DataIntegrityError, match="empty"):
            TravelRecommendationEngine(csv_path=temp_path)
    finally:
        os.remove(temp_path)

def test_missing_required_column_error():
    """Verify that missing columns raise DataIntegrityError."""
    engine = TravelRecommendationEngine()
    bad_df = engine.df.drop(columns=["budget_level", "estimated_daily_cost"])

    with tempfile.NamedTemporaryFile(suffix=".csv", mode="w", delete=False) as f:
        bad_df.to_csv(f.name, index=False)
        temp_path = f.name

    try:
        with pytest.raises(DataIntegrityError, match="Missing required columns"):
            TravelRecommendationEngine(csv_path=temp_path)
    finally:
        os.remove(temp_path)

def test_out_of_range_score_error():
    """Verify that score columns with numbers > 10 raise DataIntegrityError."""
    engine = TravelRecommendationEngine()
    bad_df = engine.df.copy()
    bad_df.loc[0, "adventure_score"] = 15  # Invalid score

    with tempfile.NamedTemporaryFile(suffix=".csv", mode="w", delete=False) as f:
        bad_df.to_csv(f.name, index=False)
        temp_path = f.name

    try:
        with pytest.raises(DataIntegrityError, match="outside \\[0, 10\\]"):
            TravelRecommendationEngine(csv_path=temp_path)
    finally:
        os.remove(temp_path)
