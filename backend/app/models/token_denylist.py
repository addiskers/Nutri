from datetime import datetime, timezone
from beanie import Document
from pydantic import Field
from pymongo import IndexModel, ASCENDING

class DeniedToken(Document):
    """Stores JTI (JWT ID) of revoked tokens so they cannot be reused."""
    jti: str = Field(..., index=True)
    denied_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime

    class Settings:
        name = "denied_tokens"
        indexes = [
            "jti",
            IndexModel(
                [("expires_at", ASCENDING)],
                expireAfterSeconds=0,
            ),
        ]
