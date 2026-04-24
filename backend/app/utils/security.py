from datetime import datetime, timedelta, timezone
from typing import Optional, Dict
from hashlib import sha256
from passlib.context import CryptContext
import jwt
from jwt.exceptions import PyJWTError
from config.settings import settings
import secrets
import uuid


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

# Key ID derived from first 8 chars of key hash (identifies which key signed a token)
_CURRENT_KID = sha256(settings.SECRET_KEY.encode()).hexdigest()[:8]


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)

    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "iat": now,
        "nbf": now,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "type": "access",
        "jti": uuid.uuid4().hex,
    })

    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM,
        headers={"kid": _CURRENT_KID},
    )
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode.update({
        "exp": expire,
        "iat": now,
        "nbf": now,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "type": "refresh",
        "jti": uuid.uuid4().hex,
    })

    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM,
        headers={"kid": _CURRENT_KID},
    )
    return encoded_jwt


def decode_token(token: str) -> Optional[Dict]:
    """Decode JWT, trying current key first then previous key (for rotation)."""
    keys_to_try = [settings.SECRET_KEY]
    if settings.PREVIOUS_SECRET_KEY:
        keys_to_try.append(settings.PREVIOUS_SECRET_KEY)

    for key in keys_to_try:
        try:
            payload = jwt.decode(
                token, key,
                algorithms=[settings.ALGORITHM],
                audience=settings.JWT_AUDIENCE,
                issuer=settings.JWT_ISSUER,
            )
            return payload
        except PyJWTError:
            continue
    return None


async def deny_token(jti: str, expires_at: datetime) -> None:
    from app.models.token_denylist import DeniedToken
    await DeniedToken(jti=jti, expires_at=expires_at).insert()


async def is_token_denied(jti: str) -> bool:
    from app.models.token_denylist import DeniedToken
    return await DeniedToken.find_one(DeniedToken.jti == jti) is not None


def generate_password_reset_token() -> str:
    return secrets.token_urlsafe(32)


def generate_otp(length: int = 8) -> str:
    return ''.join([str(secrets.randbelow(10)) for _ in range(length)])


def hash_otp(otp: str) -> str:
    return pwd_context.hash(otp)


def verify_otp(plain_otp: str, hashed_otp: str) -> bool:
    return pwd_context.verify(plain_otp, hashed_otp)


def validate_password_strength(password: str) -> tuple[bool, str]:
    if len(password) < 12:
        return False, "Password must be at least 12 characters long"
    
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"
    
    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter"
    
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one number"
    
    special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    if not any(c in special_chars for c in password):
        return False, "Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)"
    
    return True, ""

