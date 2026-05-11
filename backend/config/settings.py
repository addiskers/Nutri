from pydantic_settings import BaseSettings
from pydantic import field_validator, model_validator
from typing import Optional
import secrets

class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "nutrieyeq"

    SECRET_KEY: Optional[str] = None

    PREVIOUS_SECRET_KEY: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    JWT_ISSUER: str = "nutrieyeq-api"
    JWT_AUDIENCE: str = "nutrieyeq-dashboard"
    ALLOWED_EMAIL_DOMAINS: str = ""
    SUPER_ADMIN_EMAILS: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = ""
    FROM_NAME: str = "NutriEyeQ Dashboard"

    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = 24
    PASSWORD_RESET_OTP_EXPIRE_MINUTES: int = 15
    LOGIN_OTP_EXPIRE_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 5
    OTP_LOCKOUT_MINUTES: int = 15
    MAX_UPLOAD_FILE_SIZE_MB: int = 10
    MAX_UPLOAD_TOTAL_SIZE_MB: int = 50

    MAX_REQUEST_BODY_SIZE_MB: int = 100
    FRONTEND_URL: str = "http://localhost:5173/"
    RATE_LIMIT_PER_MINUTE: int = 60

    EXTRACT_RATE_LIMIT: str = "10/minute"
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

    @model_validator(mode='after')
    def _validate_secret_key(self):

        if not self.SECRET_KEY or self.SECRET_KEY.startswith("your-super-secret"):
            if self.DEBUG:
                object.__setattr__(self, 'SECRET_KEY', secrets.token_hex(32))
                print(
                    "[WARNING] SECRET_KEY not set; using ephemeral key. "
                    "All JWTs will be invalidated on restart. "
                    "Set SECRET_KEY in your environment for persistent sessions."
                )
            else:
                raise RuntimeError(
                    "SECRET_KEY is required when DEBUG=False. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\" "
                    "and set it via the SECRET_KEY environment variable."
                )
        return self

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
