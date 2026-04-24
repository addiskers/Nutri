import logging
import sys
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "nutrieyeq"
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
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
    ENVIRONMENT: str = "development"
    BEHIND_PROXY: bool = False
    TRUSTED_PROXY_IPS: str = "127.0.0.1,::1,172.16.0.0/12,10.0.0.0/8,192.168.0.0/16"
    PREVIOUS_SECRET_KEY: Optional[str] = None  # For key rotation: set old key here temporarily
    JWT_ISSUER: str = "nutrieyeq"
    JWT_AUDIENCE: str = "nutrieyeq-api"
    
    @field_validator('SECRET_KEY', mode='before')
    @classmethod
    def validate_secret_key(cls, v):
        if not v or len(str(v)) < 32:
            print("\n[FATAL] SECRET_KEY environment variable is missing or too short (min 32 chars).")
            print("  Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\"")
            sys.exit(1)
        return v

    @field_validator('ALGORITHM', mode='before')
    @classmethod
    def validate_algorithm(cls, v):
        allowed = {"HS256", "HS384", "HS512"}
        if v not in allowed:
            raise ValueError(f"ALGORITHM must be one of {allowed}")
        return v

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
    
    def get_super_admin_emails(self) -> list:
        if not self.SUPER_ADMIN_EMAILS:
            return []
        return [e.strip().lower() for e in self.SUPER_ADMIN_EMAILS.split(',') if e.strip()]
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


settings = Settings()
