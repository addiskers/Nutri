"""
Application Configuration Settings
"""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional
import secrets


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "nutrieyeq"
    
    # JWT Authentication
    SECRET_KEY: str = secrets.token_hex(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Azure AD Configuration
    AZURE_CLIENT_ID: str = ""
    AZURE_CLIENT_SECRET: str = ""
    AZURE_TENANT_ID: str = "common"
    AZURE_REDIRECT_URI: str = "http://localhost:5173/auth/callback"
    AZURE_AUTHORITY: Optional[str] = None
    
    # Email Domain Restrictions (comma-separated)
    ALLOWED_EMAIL_DOMAINS: str = ""  # e.g., "company.com,zydus.com"
    SUPER_ADMIN_EMAILS: str = ""  # Comma-separated emails that auto-approve as Super Admin
    
    # SMTP Email Configuration (for OTP, password reset, notifications)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = ""
    FROM_NAME: str = "NutriEyeQ Dashboard"
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = 24
    
    # Frontend
    FRONTEND_URL: str = "http://localhost:5173/"
    
    # Security
    RATE_LIMIT_PER_MINUTE: int = 60
    
    # App
    APP_NAME: str = "NutriEyeQ Dashboard"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"  # For logging level configuration
    
    # Gemini AI (for product image extraction)
    GEMINI_API_KEY: Optional[str] = None
    
    @field_validator('DEBUG', mode='before')
    @classmethod
    def parse_debug(cls, v):
        """Handle DEBUG as boolean or string"""
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            # Convert common string values to boolean
            if v.lower() in ('true', '1', 'yes', 'on'):
                return True
            elif v.lower() in ('false', '0', 'no', 'off', 'warn', 'info', 'error'):
                return False
        return bool(v)
    
    def get_azure_authority(self) -> str:
        """Get Azure AD authority URL"""
        if self.AZURE_AUTHORITY:
            return self.AZURE_AUTHORITY
        return f"https://login.microsoftonline.com/{self.AZURE_TENANT_ID}"
    
    def get_allowed_domains(self) -> list:
        """Get list of allowed email domains"""
        if not self.ALLOWED_EMAIL_DOMAINS:
            return []
        return [d.strip() for d in self.ALLOWED_EMAIL_DOMAINS.split(',') if d.strip()]
    
    def get_super_admin_emails(self) -> list:
        """Get list of super admin emails"""
        if not self.SUPER_ADMIN_EMAILS:
            return []
        return [e.strip().lower() for e in self.SUPER_ADMIN_EMAILS.split(',') if e.strip()]
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"  # Ignore extra fields from .env


settings = Settings()
