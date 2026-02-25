from typing import Optional, List, Dict, Any
from datetime import datetime
from beanie import Document
from pydantic import Field


class NutrientData(Dict):
    nutrient_name: str
    nutrient_name_raw: str
    actual_value: Optional[float] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    average_value: Optional[float] = None
    unit: str
    unit_raw: str
    basis: str = "per 100g"
    category: Optional[str] = None
    source_section: Optional[str] = None
    notes: Optional[str] = None


class COA(Document):
    ingredient_name: str
    product_code: Optional[str] = None
    lot_number: Optional[str] = None
    manufacturing_date: Optional[str] = None
    expiry_date: Optional[str] = None
    shelf_life: Optional[str] = None
    supplier_name: Optional[str] = None
    supplier_address: Optional[str] = None
    storage_condition: Optional[str] = None
    nutritional_data: List[Dict[str, Any]] = Field(default_factory=list)
    other_parameters: List[Dict[str, Any]] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    analysis_method: Optional[str] = None
    additional_notes: List[str] = Field(default_factory=list)
    document_images: List[str] = Field(default_factory=list)
    extraction_date: Optional[str] = None
    extraction_cost: Optional[Dict[str, Any]] = None
    processing_status: str = "extracted"
    master_entry: Optional[Dict[str, Any]] = None
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "active"
    
    class Settings:
        name = "coa"
        
    class Config:
        json_schema_extra = {
            "example": {
                "ingredient_name": "Whey Protein Concentrate",
                "supplier_name": "ABC Supplier",
                "lot_number": "LOT-2024-001",
                "nutritional_data": [
                    {
                        "nutrient_name": "Protein",
                        "nutrient_name_raw": "Crude Protein",
                        "actual_value": 80.5,
                        "min_value": 78.0,
                        "max_value": 82.0,
                        "unit": "g",
                        "basis": "per 100g"
                    }
                ]
            }
        }

