import asyncio
import random
from fastapi import APIRouter, HTTPException, status, Depends, Request, Response
from datetime import datetime, timedelta, timezone


def _as_utc(dt: datetime) -> datetime:
    """Coerce a naive datetime (assumed UTC) to aware. Handles old DB documents."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)
from app.models.user import User, UserRole
from app.schemas.auth import (
    UserRegister, UserLogin, VerifyLoginOTP, ForgotPassword, ResetPassword, ChangePassword,
    LogoutRequest, TokenResponse, UserResponse, MessageResponse
)
from app.utils.security import (
    create_access_token, create_refresh_token, decode_token,
    hash_password, verify_password, generate_otp, hash_otp, verify_otp,
    validate_password_strength, deny_token, is_token_denied
)
from app.utils.email import send_login_otp_email, send_password_reset_email, send_user_approval_email
from app.utils.audit import log_event
from app.dependencies.auth import get_current_user
from app.middleware.security import limiter
from config.settings import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# Refresh-token cookie configuration.
# Path scoped to /api/auth so the browser only attaches it to auth endpoints.
# `Secure` is conditional on environment so local HTTP dev still works; in any
# deployed environment (production / uat / staging) the cookie is HTTPS-only.
REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_PATH = "/api/auth"


def _refresh_cookie_secure() -> bool:
    return (settings.ENVIRONMENT or "").lower() in ("production", "prod", "uat", "staging")


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=_refresh_cookie_secure(),
        samesite="strict",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path=REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
    )


def _require_csrf_header(request: Request) -> None:
    # Custom-header CSRF defence: browsers cannot set this header on a
    # cross-origin request without a CORS preflight that our backend would
    # reject for unknown origins. Layered with SameSite=Strict on the cookie.
    if request.headers.get("x-requested-with") != "XMLHttpRequest":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing CSRF header",
        )


@router.post("/register", response_model=MessageResponse)
@limiter.limit("3/minute")
async def register(request: Request, user_data: UserRegister):
    is_valid, error_msg = validate_password_strength(user_data.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )

    # Constant-time delay on all paths to prevent user enumeration via timing
    await asyncio.sleep(random.uniform(0.2, 0.6))

    existing_user = await User.find_one(User.email == user_data.email.lower())
    if existing_user:
        return MessageResponse(
            message="Registration successful! Your account is pending admin approval.",
            success=True
        )
    
    # Always register as Researcher first -- promote to Super Admin only after
    # verifying no other Super Admin exists (prevents race condition)
    new_user = User(
        name=user_data.name,
        email=user_data.email.lower(),
        hashed_password=hash_password(user_data.password),
        department=user_data.department,
        role=UserRole.RESEARCHER,
        is_active=True,
        is_verified=True,
        is_approved=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    new_user.update_permissions_by_role()

    try:
        await new_user.insert()
    except Exception:
        recheck = await User.find_one(User.email == user_data.email.lower())
        if recheck:
            return MessageResponse(
                message="Registration successful! Your account is pending admin approval.",
                success=True
            )
        raise

    # After insert, atomically check if this is the only user (no Super Admin exists)
    existing_super = await User.find_one(
        User.role == UserRole.SUPER_ADMIN,
        User.is_active == True,
    )
    is_first_user = existing_super is None

    if is_first_user:
        # Promote to Super Admin only if no other Super Admin was created in the meantime
        new_user.role = UserRole.SUPER_ADMIN
        new_user.is_approved = True
        new_user.update_permissions_by_role()
        await new_user.save()

        # Final verification: if another Super Admin appeared during our save, demote back
        super_count = await User.find(User.role == UserRole.SUPER_ADMIN).count()
        if super_count > 1:
            first_super = await User.find_one(
                User.role == UserRole.SUPER_ADMIN,
                {"_id": {"$ne": new_user.id}},
            )
            if first_super:
                new_user.role = UserRole.RESEARCHER
                new_user.is_approved = False
                new_user.update_permissions_by_role()
                await new_user.save()
                return MessageResponse(
                    message="Registration successful! Your account is pending admin approval.",
                    success=True
                )

    if is_first_user:
        logger.info("First user registered as Super Admin")
        return MessageResponse(
            message="Welcome! You are the first user and have been granted Super Admin privileges.",
            success=True
        )
    
    # Send approval emails to existing admins as a background task so the response
    # time of /register does not depend on whether the user already existed
    # (defends against user-enumeration via timing analysis).
    async def _notify_super_admins(new_user_id: str, new_user_name: str, new_user_email: str, new_user_dept: str) -> None:
        try:
            super_admins = await User.find(User.role == UserRole.SUPER_ADMIN, User.is_active == True).to_list()
            logger.info("Found %d super admins to notify", len(super_admins))
            for admin in super_admins:
                try:
                    await send_user_approval_email(
                        admin_email=admin.email,
                        admin_name=admin.name,
                        new_user_name=new_user_name,
                        new_user_email=new_user_email,
                        new_user_id=new_user_id,
                        department=new_user_dept,
                    )
                    logger.info("Approval email sent to admin")
                except Exception as e:
                    logger.warning("Failed to send approval email: %s", type(e).__name__)
        except Exception as e:
            logger.error("Failed to notify super admins: %s", type(e).__name__)

    asyncio.create_task(_notify_super_admins(
        str(new_user.id), new_user.name, new_user.email,
        new_user.department or "Not specified",
    ))

    logger.info("New user registered")
    
    return MessageResponse(
        message="Registration successful! Your account is pending admin approval.",
        success=True
    )


MAX_LOGIN_ATTEMPTS = 10
LOGIN_LOCKOUT_MINUTES = 15


@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, credentials: UserLogin):
    user = await User.find_one(User.email == credentials.email.lower())
    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Check login lockout before doing any password work
    if user.login_locked_until and _as_utc(user.login_locked_until) > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again later."
        )

    if not verify_password(credentials.password, user.hashed_password):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= MAX_LOGIN_ATTEMPTS:
            user.login_locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOGIN_LOCKOUT_MINUTES)
            logger.warning("Login locked after %d failed attempts", user.failed_login_attempts)
            log_event("LOGIN_LOCKED", user_id=str(user.id), user_email=user.email, detail=f"attempts={user.failed_login_attempts}")
        else:
            log_event("LOGIN_FAILED", user_id=str(user.id), user_email=user.email, detail=f"attempts={user.failed_login_attempts}")
        await user.save()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Successful password — clear lockout state
    user.failed_login_attempts = 0
    user.login_locked_until = None

    if not user.is_approved:
        logger.warning("Login attempt by unapproved user")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated"
        )

    otp = generate_otp()
    user.login_otp = hash_otp(otp)
    user.login_otp_expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    user.otp_attempts = 0
    user.otp_locked_until = None
    await user.save()

    try:
        await send_login_otp_email(user.email, otp, user.name)
    except Exception as e:
        logger.error("Failed to send OTP email: %s", type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email. Please try again."
        )
    
    return MessageResponse(
        message="OTP sent to your email. Please verify to continue.",
        success=True
    )


MAX_OTP_ATTEMPTS = 3
OTP_LOCKOUT_MINUTES_BASE = 15  # Escalates: 15min, 30min, 60min, 240min


def _get_lockout_duration(lockout_count: int) -> int:
    """Exponential backoff for repeated OTP lockouts (in minutes)."""
    multipliers = [1, 2, 4, 16]  # 15min, 30min, 60min, 240min
    idx = min(lockout_count, len(multipliers) - 1)
    return OTP_LOCKOUT_MINUTES_BASE * multipliers[idx]


@router.post("/verify-otp", response_model=TokenResponse)
@limiter.limit("3/minute")
async def verify_login_otp(request: Request, response: Response, otp_data: VerifyLoginOTP):
    user = await User.find_one(User.email == otp_data.email.lower())
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP"
        )

    # Check OTP lockout
    if user.otp_locked_until and _as_utc(user.otp_locked_until) > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Please try again later."
        )

    if not user.login_otp or not verify_otp(otp_data.otp, user.login_otp):
        user.otp_attempts = (user.otp_attempts or 0) + 1
        if user.otp_attempts >= MAX_OTP_ATTEMPTS:
            lockout_minutes = _get_lockout_duration(user.otp_lockout_count or 0)
            user.otp_locked_until = datetime.now(timezone.utc) + timedelta(minutes=lockout_minutes)
            user.otp_lockout_count = (user.otp_lockout_count or 0) + 1
            user.login_otp = None
            user.login_otp_expires = None
            logger.warning("OTP locked for user after %d failed attempts (lockout %d: %d min)",
                           user.otp_attempts, user.otp_lockout_count, lockout_minutes)
        await user.save()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP"
        )
    
    if not user.login_otp_expires or _as_utc(user.login_otp_expires) < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTP expired. Please request a new one."
        )
    
    # Success — reset OTP state
    user.login_otp = None
    user.login_otp_expires = None
    user.otp_attempts = 0
    user.otp_locked_until = None
    user.otp_lockout_count = 0
    user.last_login = datetime.now(timezone.utc)
    await user.save()
    
    # Create JWT tokens
    token_data = {
        "user_id": str(user.id),
        "email": user.email,
        "role": user.role,
        "tv": user.token_version,
    }

    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    # Refresh token is delivered as an httpOnly + Secure + SameSite=Strict cookie
    # (not exposed to JavaScript) to eliminate the XSS-theft vector. The body
    # field is left blank for backwards compatibility with older clients.
    _set_refresh_cookie(response, refresh_token)

    logger.info("User logged in")
    log_event("LOGIN", user_id=str(user.id), user_email=user.email)

    return TokenResponse(
        access_token=access_token,
        refresh_token="",
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.from_user(user)
    )


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("10/minute")
async def refresh_token(request: Request, response: Response):
    """Exchange a valid refresh token (read from httpOnly cookie) for a new access
    + refresh token pair (rotation)."""
    _require_csrf_header(request)

    cookie_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not cookie_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token",
        )

    payload = decode_token(cookie_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    jti = payload.get("jti")
    if jti and await is_token_denied(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked",
        )

    if jti:
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        await deny_token(jti, exp)

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = await User.get(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    # Reject refresh tokens issued before a password change
    token_version = payload.get("tv", 0)
    if token_version != (user.token_version or 0):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired due to password change",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )
    if not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not approved",
        )

    token_data = {
        "user_id": str(user.id),
        "email": user.email,
        "role": user.role,
        "tv": user.token_version,
    }

    new_access = create_access_token(token_data)
    new_refresh = create_refresh_token(token_data)

    _set_refresh_cookie(response, new_refresh)

    return TokenResponse(
        access_token=new_access,
        refresh_token="",
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.from_user(user),
    )


@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit("3/minute")
async def forgot_password(request: Request, forgot_data: ForgotPassword):
    """
    Request password reset OTP

    Both branches (user-exists, user-not-exists) take roughly the same wall-clock
    time and return the same message body. Email delivery happens in a background
    task so response timing does not leak account existence.
    """
    # Always pay the same minimum delay so both paths are time-equalised.
    await asyncio.sleep(random.uniform(0.2, 0.5))

    user = await User.find_one(User.email == forgot_data.email.lower())
    if not user:
        return MessageResponse(
            message="If the email exists, a password reset OTP has been sent.",
            success=True
        )

    otp = generate_otp()
    user.reset_token = hash_otp(otp)
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS)
    await user.save()

    async def _send_reset_email_bg(email: str, code: str, name: str) -> None:
        try:
            await send_password_reset_email(email, code, name)
        except Exception as e:
            logger.error("Failed to send password reset email: %s", type(e).__name__)

    asyncio.create_task(_send_reset_email_bg(user.email, otp, user.name))

    logger.info("Password reset OTP scheduled for delivery")

    return MessageResponse(
        message="If the email exists, a password reset OTP has been sent.",
        success=True
    )


@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit("3/minute")
async def reset_password(request: Request, reset_data: ResetPassword):
    """
    Reset password using OTP
    """
    user = await User.find_one(User.email == reset_data.email.lower())
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP"
        )

    # Check OTP lockout
    if user.otp_locked_until and _as_utc(user.otp_locked_until) > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Please try again later."
        )

    if not user.reset_token or not verify_otp(reset_data.otp, user.reset_token):
        user.otp_attempts = (user.otp_attempts or 0) + 1
        if user.otp_attempts >= MAX_OTP_ATTEMPTS:
            lockout_minutes = _get_lockout_duration(user.otp_lockout_count or 0)
            user.otp_locked_until = datetime.now(timezone.utc) + timedelta(minutes=lockout_minutes)
            user.otp_lockout_count = (user.otp_lockout_count or 0) + 1
            user.reset_token = None
            user.reset_token_expires = None
            logger.warning("Reset OTP locked for user after %d failed attempts (lockout %d: %d min)",
                           user.otp_attempts, user.otp_lockout_count, lockout_minutes)
        await user.save()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP"
        )
    
    # Check expiration
    if not user.reset_token_expires or _as_utc(user.reset_token_expires) < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTP expired"
        )
    
    is_valid, error_msg = validate_password_strength(reset_data.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    user.hashed_password = hash_password(reset_data.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    user.otp_attempts = 0
    user.otp_locked_until = None
    user.otp_lockout_count = 0
    user.token_version = (user.token_version or 0) + 1
    user.updated_at = datetime.now(timezone.utc)
    await user.save()

    logger.info("Password reset completed — all prior sessions invalidated")
    log_event("PASSWORD_RESET", user_id=str(user.id), user_email=user.email)
    
    return MessageResponse(
        message="Password reset successful. You can now login with your new password.",
        success=True
    )


@router.post("/change-password", response_model=MessageResponse)
@limiter.limit("5/minute")
async def change_password(
    request: Request,
    password_data: ChangePassword,
    current_user: User = Depends(get_current_user)
):
    """
    Change password for authenticated user
    """
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )
    
    is_valid, error_msg = validate_password_strength(password_data.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    current_user.hashed_password = hash_password(password_data.new_password)
    current_user.token_version = (current_user.token_version or 0) + 1
    current_user.updated_at = datetime.now(timezone.utc)
    await current_user.save()
    
    logger.info("Password changed")
    log_event("PASSWORD_CHANGE", user_id=str(current_user.id), user_email=current_user.email)
    
    return MessageResponse(
        message="Password changed successfully",
        success=True
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user's information
    
    Requires valid JWT token
    """
    return UserResponse.from_user(current_user)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    body: LogoutRequest = LogoutRequest(),
    current_user: User = Depends(get_current_user),
):
    """Logout: revoke both the current access token and the refresh token (read
    from cookie, with body fallback for legacy clients), then clear the cookie."""
    # Deny the access token
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        payload = decode_token(auth_header.split(" ", 1)[1])
        if payload and payload.get("jti"):
            exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
            await deny_token(payload["jti"], exp)

    # Deny the refresh token: prefer cookie, fall back to body
    refresh_value = request.cookies.get(REFRESH_COOKIE_NAME) or body.refresh_token
    if refresh_value:
        refresh_payload = decode_token(refresh_value)
        if refresh_payload and refresh_payload.get("type") == "refresh" and refresh_payload.get("jti"):
            exp = datetime.fromtimestamp(refresh_payload["exp"], tz=timezone.utc)
            await deny_token(refresh_payload["jti"], exp)

    _clear_refresh_cookie(response)

    logger.info("User logged out")
    log_event("LOGOUT", user_id=str(current_user.id), user_email=current_user.email)
    return MessageResponse(
        message="Logged out successfully",
        success=True
    )
