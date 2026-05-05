from datetime import datetime
from typing import Optional, List
from beanie import Document
from pydantic import EmailStr, Field
from enum import Enum


class AuthProvider(str, Enum):
    LOCAL = "local"


class UserRole(str, Enum):
    SUPER_ADMIN = "Super Admin"
    ADMIN = "Admin"
    RESEARCHER = "Researcher"


class UserPermissions(str, Enum):
    VIEW_PRODUCTS = "view_products"
    ADD_PRODUCTS = "add_products"
    EDIT_PRODUCTS = "edit_products"
    DELETE_PRODUCTS = "delete_products"
    VIEW_USERS = "view_users"
    ADD_USERS = "add_users"
    EDIT_USERS = "edit_users"
    DELETE_USERS = "delete_users"
    MANAGE_PERMISSIONS = "manage_permissions"
    VIEW_NOMENCLATURE = "view_nomenclature"
    EDIT_NOMENCLATURE = "edit_nomenclature"
    RUN_COMPARISONS = "run_comparisons"
    VIEW_ANALYTICS = "view_analytics"
    EXPORT_DATA = "export_data"


ROLE_PERMISSIONS = {
    UserRole.SUPER_ADMIN: [perm.value for perm in UserPermissions],
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
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr = Field(..., unique=True, index=True)
    auth_provider: AuthProvider = Field(default=AuthProvider.LOCAL)
    hashed_password: Optional[str] = None
    # Legacy single-OTP field. Retained for backward-compat on old records;
    # new code uses login_otp / password_reset_otp.
    reset_token: Optional[str] = None
    reset_token_expires: Optional[datetime] = None
    # Login and password-reset OTPs are stored in separate fields so that
    # starting one flow cannot invalidate the other.
    login_otp: Optional[str] = None
    login_otp_expires: Optional[datetime] = None
    password_reset_otp: Optional[str] = None
    password_reset_otp_expires: Optional[datetime] = None
    otp_attempts: int = Field(default=0)
    otp_lockout_until: Optional[datetime] = None
    # Bumped on password change / reset so previously issued JWTs are rejected
    # even though JWT itself is stateless.
    token_version: int = Field(default=0)
    department: Optional[str] = None
    job_title: Optional[str] = None
    role: UserRole = Field(default=UserRole.RESEARCHER)
    permissions: List[str] = Field(default_factory=list)
    is_active: bool = Field(default=True)
    is_verified: bool = Field(default=True)
    is_approved: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    
    class Settings:
        name = "users"
        indexes = [
            "email",
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
        return ''.join([n[0].upper() for n in self.name.split()[:2]])
    
    def has_permission(self, permission: str) -> bool:
        return permission in self.permissions
    
    def update_permissions_by_role(self):
        self.permissions = ROLE_PERMISSIONS.get(self.role, [])

