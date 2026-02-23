"""
User Model with Role-Based Access Control
"""
from datetime import datetime
from typing import Optional, List
from beanie import Document
from pydantic import EmailStr, Field
from enum import Enum


class AuthProvider(str, Enum):
    """Authentication provider types"""
    AZURE_AD = "azure_ad"
    LOCAL = "local"  # Legacy password-based (deprecated)


class UserRole(str, Enum):
    """User roles for RBAC"""
    SUPER_ADMIN = "Super Admin"
    ADMIN = "Admin"
    RESEARCHER = "Researcher"


class UserPermissions(str, Enum):
    """Granular permissions"""
    # Product permissions
    VIEW_PRODUCTS = "view_products"
    ADD_PRODUCTS = "add_products"
    EDIT_PRODUCTS = "edit_products"
    DELETE_PRODUCTS = "delete_products"
    
    # User management
    VIEW_USERS = "view_users"
    ADD_USERS = "add_users"
    EDIT_USERS = "edit_users"
    DELETE_USERS = "delete_users"
    MANAGE_PERMISSIONS = "manage_permissions"
    
    # Nomenclature
    VIEW_NOMENCLATURE = "view_nomenclature"
    EDIT_NOMENCLATURE = "edit_nomenclature"
    
    # Compare & Analytics
    RUN_COMPARISONS = "run_comparisons"
    VIEW_ANALYTICS = "view_analytics"
    EXPORT_DATA = "export_data"


# Default permissions by role
ROLE_PERMISSIONS = {
    UserRole.SUPER_ADMIN: [perm.value for perm in UserPermissions],  # All permissions
    UserRole.ADMIN: [
        UserPermissions.VIEW_PRODUCTS,
        UserPermissions.ADD_PRODUCTS,
        UserPermissions.EDIT_PRODUCTS,
        UserPermissions.DELETE_PRODUCTS,
        UserPermissions.VIEW_USERS,
        UserPermissions.ADD_USERS,
        UserPermissions.EDIT_USERS,
        UserPermissions.VIEW_NOMENCLATURE,
        UserPermissions.EDIT_NOMENCLATURE,
        UserPermissions.RUN_COMPARISONS,
        UserPermissions.VIEW_ANALYTICS,
        UserPermissions.EXPORT_DATA,
    ],
    UserRole.RESEARCHER: [
        UserPermissions.VIEW_PRODUCTS,
        UserPermissions.VIEW_USERS,
        UserPermissions.VIEW_NOMENCLATURE,
        UserPermissions.RUN_COMPARISONS,
        UserPermissions.VIEW_ANALYTICS,
    ]
}


class User(Document):
    """User model for authentication and authorization"""
    
    # Basic Information
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr = Field(..., unique=True, index=True)
    
    # Authentication
    azure_id: Optional[str] = Field(default=None, unique=True, index=True)
    auth_provider: AuthProvider = Field(default=AuthProvider.AZURE_AD)
    hashed_password: Optional[str] = None  # Legacy field, optional for Azure AD users
    
    # OTP & Password Reset
    reset_token: Optional[str] = None  # Stores OTP for login/password reset
    reset_token_expires: Optional[datetime] = None  # OTP expiration time
    
    # Profile
    department: Optional[str] = None
    job_title: Optional[str] = None
    
    # Role & Permissions
    role: UserRole = Field(default=UserRole.RESEARCHER)
    permissions: List[str] = Field(default_factory=list)
    
    # Status
    is_active: bool = Field(default=True)
    is_verified: bool = Field(default=True)  # Azure AD users are pre-verified
    is_approved: bool = Field(default=False)  # Requires admin approval
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    
    class Settings:
        name = "users"
        indexes = [
            "email",
            "azure_id",
            "role",
            "is_active",
            "is_approved",
            "auth_provider"
        ]
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Aisha Khan",
                "email": "aisha@wellnessco.com",
                "department": "Platform Ops",
                "role": "Super Admin",
                "is_active": True
            }
        }
    
    def get_initials(self) -> str:
        """Generate user initials from name"""
        return ''.join([n[0].upper() for n in self.name.split()[:2]])
    
    def has_permission(self, permission: str) -> bool:
        """Check if user has a specific permission"""
        return permission in self.permissions
    
    def update_permissions_by_role(self):
        """Update permissions based on role"""
        self.permissions = ROLE_PERMISSIONS.get(self.role, [])

