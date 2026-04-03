from typing import List, Optional
from datetime import datetime, timezone
from beanie import Document
from pydantic import Field


class COANomenclatureMapping(Document):
    standardized_name: str = Field(..., min_length=1, max_length=100)
    raw_names: List[str] = Field(default_factory=list)
    target_unit: Optional[str] = None
    category: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None

    class Settings:
        name = "coa_nomenclature_mappings"
        indexes = ["standardized_name"]

    class Config:
        json_schema_extra = {
            "example": {
                "standardized_name": "Protein",
                "raw_names": ["protein", "proteins", "crude protein", "total protein"],
                "target_unit": "g",
                "category": "Macronutrient"
            }
        }
