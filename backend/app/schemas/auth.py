from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    department: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Aisha Khan",
                "email": "aisha@wellnessco.com",
                "password": "SecurePass123",
                "department": "Platform Ops"
            }
        }


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "aisha@wellnessco.com",
                "password": "SecurePass123"
            }
        }


class VerifyLoginOTP(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "otp": "123456"
            }
        }


class ForgotPassword(BaseModel):
    email: EmailStr
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "aisha@wellnessco.com"
            }
        }


class ResetPassword(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8)
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "otp": "123456",
                "new_password": "NewSecurePass123"
            }
        }


class ChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)
    
    class Config:
        json_schema_extra = {
            "example": {
                "current_password": "OldPass123",
                "new_password": "NewSecurePass123"
            }
        }


class AzureAuthRequest(BaseModel):
    code: str = Field(..., description="Authorization code from Azure AD")
    state: Optional[str] = Field(None, description="CSRF protection state")
    
    class Config:
        json_schema_extra = {
            "example": {
                "code": "0.AXoA...",
                "state": "random-state-string"
            }
        }


class AzureAuthUrlResponse(BaseModel):
    auth_url: str = Field(..., description="Azure AD authorization URL")
    state: str = Field(..., description="CSRF protection state")
    
    class Config:
        json_schema_extra = {
            "example": {
                "auth_url": "https://login.microsoftonline.com/...",
                "state": "random-state-string"
            }
        }


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: 'UserResponse'


class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    department: Optional[str]
    job_title: Optional[str]
    role: str
    permissions: List[str]
    is_active: bool
    is_verified: bool
    is_approved: bool
    auth_provider: str
    created_at: datetime
    last_login: Optional[datetime]

    @classmethod
    def from_user(cls, user):
        return cls(
            id=str(user.id),
            name=user.name,
            email=user.email,
            department=user.department,
            job_title=user.job_title,
            role=user.role,
            permissions=user.permissions,
            is_active=user.is_active,
            is_verified=user.is_verified,
            is_approved=user.is_approved,
            auth_provider=user.auth_provider,
            created_at=user.created_at,
            last_login=user.last_login
        )

    class Config:
        json_schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439011",
                "name": "Aisha Khan",
                "email": "aisha@wellnessco.com",
                "department": "Platform Ops",
                "role": "Super Admin",
                "permissions": ["view_products", "add_products", "..."],
                "is_active": True,
                "is_verified": True,
                "created_at": "2026-01-22T10:00:00Z",
                "last_login": "2026-01-22T15:30:00Z"
            }
        }


class MessageResponse(BaseModel):
    message: str
    success: bool = True
    
    class Config:
        json_schema_extra = {
            "example": {
                "message": "Operation completed successfully",
                "success": True
            }
        }

