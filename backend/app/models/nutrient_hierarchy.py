from typing import List, Optional
from datetime import datetime, timezone
from beanie import Document
from pydantic import Field


class NutrientHierarchyNode(Document):
    nutrient_name: str = Field(..., min_length=1, max_length=100)
    parent_nutrient: Optional[str] = None
    rule: Optional[str] = None  # "gte_sum" | "collapse_variants" | None
    is_additive: bool = True
    variants: List[str] = Field(default_factory=list)
    display_order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None

    class Settings:
        name = "nutrient_hierarchy"
        indexes = ["nutrient_name", "parent_nutrient"]

    class Config:
        json_schema_extra = {
            "example": {
                "nutrient_name": "Total Fat",
                "parent_nutrient": None,
                "rule": "gte_sum",
                "is_additive": True,
                "variants": [],
                "display_order": 0
            }
        }
