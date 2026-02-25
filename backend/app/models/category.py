from typing import Optional
from datetime import datetime
from beanie import Document
from pydantic import Field


class Category(Document):
    name: str = Field(..., min_length=2, max_length=100, unique=True)
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None
    
    class Settings:
        name = "categories"
        indexes = ["name"]
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Health Supplements",
                "description": "Used for product classification"
            }
        }





