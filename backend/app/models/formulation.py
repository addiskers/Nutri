from typing import Optional, List, Dict, Any
from datetime import datetime
from beanie import Document
from pydantic import Field


class FormulationIngredient(Dict):
    coa_id: str
    coa_name: str
    percentage: float
    nutritional_data: Dict[str, Any] = {}


class SavedFormulation(Document):
    name: str
    ingredients: List[Dict[str, Any]] = Field(default_factory=list)
    nutrient_selections: Dict[str, str] = Field(default_factory=dict)
    custom_values: Dict[str, float] = Field(default_factory=dict)
    serve_size: float = 30.0
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "active"
    
    class Settings:
        name = "saved_formulations"
        
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Protein Bar v1",
                "ingredients": [
                    {
                        "coa_id": "abc123",
                        "coa_name": "Whey Protein",
                        "percentage": 40.0,
                        "nutritional_data": {"Protein": 80.5, "Fat": 5.2}
                    }
                ],
                "serve_size": 30.0,
                "created_by": "admin"
            }
        }
