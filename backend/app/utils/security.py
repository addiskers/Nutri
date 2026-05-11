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

_CURRENT_KID = sha256(settings.SECRET_KEY.encode()).hexdigest()[:8]

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

_DUMMY_VERIFY_HASH = pwd_context.hash(secrets.token_urlsafe(32))

def verify_dummy_password(plain_password: str) -> None:
    """Spend a bcrypt verify against a fixed dummy hash to mask timing.

    Call this on the missing-user branch of authentication so the response
    time matches the wrong-password branch. Always returns ``None``; the
    boolean result is discarded on purpose.
    """
    try:
        pwd_context.verify(plain_password or "", _DUMMY_VERIFY_HASH)
    except (ValueError, TypeError):
        pass

def verify_dummy_otp(plain_otp: str) -> None:
    """Same shape as ``verify_dummy_password`` but named for the OTP paths.

    OTP verify and password verify share a bcrypt context, so the wall-clock
    cost is identical. Use this on the missing-user / no-active-OTP / expired-
    OTP branches of ``/verify-otp`` and ``/reset-password`` so an attacker
    can't tell from response time whether the target email has an active OTP.
    """
    try:
        pwd_context.verify(plain_otp or "", _DUMMY_VERIFY_HASH)
    except (ValueError, TypeError):
        pass

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

    if not plain_otp or not hashed_otp:
        return False
    try:
        return pwd_context.verify(plain_otp, hashed_otp)
    except (ValueError, TypeError):
        return False

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

