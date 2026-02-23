"""
Nomenclature Mapping Model for Nutrition Standardization
"""
from typing import List, Optional
from datetime import datetime
from beanie import Document
from pydantic import Field


class NomenclatureMapping(Document):
    """
    Maps raw nutrition names to standardized names
    Example: "crude protein" -> "Protein"
    """
    
    standardized_name: str = Field(..., min_length=1, max_length=100)
    raw_names: List[str] = Field(default_factory=list)  # List of synonyms/variations
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None
    
    class Settings:
        name = "nomenclature_mappings"
        indexes = ["standardized_name"]
    
    class Config:
        json_schema_extra = {
            "example": {
                "standardized_name": "Protein",
                "raw_names": ["protein", "proteins", "crude protein", "total protein"]
            }
        }

