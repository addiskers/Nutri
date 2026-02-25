from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional
import secrets


class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "nutrieyeq"
    SECRET_KEY: str = secrets.token_hex(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    AZURE_CLIENT_ID: str = ""
    AZURE_CLIENT_SECRET: str = ""
    AZURE_TENANT_ID: str = "common"
    AZURE_REDIRECT_URI: str = "http://localhost:5173/auth/callback"
    AZURE_AUTHORITY: Optional[str] = None
    ALLOWED_EMAIL_DOMAINS: str = ""
    SUPER_ADMIN_EMAILS: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = ""
    FROM_NAME: str = "NutriEyeQ Dashboard"
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = 24
    FRONTEND_URL: str = "http://localhost:5173/"
    RATE_LIMIT_PER_MINUTE: int = 60
    APP_NAME: str = "NutriEyeQ Dashboard"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    GEMINI_API_KEY: Optional[str] = None
    
    @field_validator('DEBUG', mode='before')
    @classmethod
    def parse_debug(cls, v):
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            if v.lower() in ('true', '1', 'yes', 'on'):
                return True
            elif v.lower() in ('false', '0', 'no', 'off', 'warn', 'info', 'error'):
                return False
        return bool(v)
    
    def get_azure_authority(self) -> str:
        if self.AZURE_AUTHORITY:
            return self.AZURE_AUTHORITY
        return f"https://login.microsoftonline.com/{self.AZURE_TENANT_ID}"
    
    def get_allowed_domains(self) -> list:
        if not self.ALLOWED_EMAIL_DOMAINS:
            return []
        return [d.strip() for d in self.ALLOWED_EMAIL_DOMAINS.split(',') if d.strip()]
    
    def get_super_admin_emails(self) -> list:
        if not self.SUPER_ADMIN_EMAILS:
            return []
        return [e.strip().lower() for e in self.SUPER_ADMIN_EMAILS.split(',') if e.strip()]
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


settings = Settings()
