"""
COA (Certificate of Analysis) Model for NutriEyeQ
Stores extracted nutritional data from supplier COA documents
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from beanie import Document
from pydantic import Field


class NutrientData(Dict):
    """Individual nutrient entry from COA"""
    nutrient_name: str  # Standardized name
    nutrient_name_raw: str  # Original name from document
    actual_value: Optional[float] = None  # Analyzed/actual value
    min_value: Optional[float] = None  # Minimum specification
    max_value: Optional[float] = None  # Maximum specification
    average_value: Optional[float] = None  # Calculated average of min/max
    unit: str  # Normalized unit (g, mg, mcg, kcal)
    unit_raw: str  # Original unit from document
    basis: str = "per 100g"  # Basis for values
    category: Optional[str] = None  # Nutrient category
    source_section: Optional[str] = None  # Where in document found
    notes: Optional[str] = None  # Any relevant notes


class COA(Document):
    """COA Document Model - Certificate of Analysis"""
    
    # Ingredient Information
    ingredient_name: str
    product_code: Optional[str] = None
    lot_number: Optional[str] = None
    manufacturing_date: Optional[str] = None
    expiry_date: Optional[str] = None
    supplier_name: Optional[str] = None
    supplier_address: Optional[str] = None
    storage_condition: Optional[str] = None
    
    # Nutritional Data (main data from COA)
    nutritional_data: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Other Parameters (pH, particle size, etc.)
    other_parameters: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Certifications found on document
    certifications: List[str] = Field(default_factory=list)
    
    # Analysis method if mentioned
    analysis_method: Optional[str] = None
    
    # Additional notes from extraction
    additional_notes: List[str] = Field(default_factory=list)
    
    # Document images (stored as base64 or URLs)
    document_images: List[str] = Field(default_factory=list)
    
    # Extraction metadata
    extraction_date: Optional[str] = None
    extraction_cost: Optional[Dict[str, Any]] = None
    processing_status: str = "extracted"  # "extracted" | "normalized" | "verified"
    
    # Master entry format (for formulation calculations)
    master_entry: Optional[Dict[str, Any]] = None
    
    # Metadata
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Status
    status: str = "active"  # "active" | "archived" | "draft"
    
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

