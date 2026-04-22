from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=12)
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
    password: str = Field(..., max_length=128)
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "aisha@wellnessco.com",
                "password": "SecurePass123"
            }
        }


class VerifyLoginOTP(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=8, max_length=8)

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "otp": "12345678"
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
    otp: str = Field(..., min_length=8, max_length=8)
    new_password: str = Field(..., min_length=12)

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "otp": "12345678",
                "new_password": "NewSecurePass!123"
            }
        }


class ChangePassword(BaseModel):
    current_password: str = Field(..., max_length=128)
    new_password: str = Field(..., min_length=12, max_length=128)
    
    class Config:
        json_schema_extra = {
            "example": {
                "current_password": "OldPass123",
                "new_password": "NewSecurePass123"
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


class RefreshTokenRequest(BaseModel):
    refresh_token: str

    class Config:
        json_schema_extra = {
            "example": {
                "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
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

