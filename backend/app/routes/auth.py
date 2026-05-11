from fastapi import APIRouter, HTTPException, status, Depends, Request, BackgroundTasks
from fastapi.security import HTTPAuthorizationCredentials
from datetime import datetime, timedelta, timezone
from app.models.user import User, UserRole, AuthProvider
from app.schemas.auth import (
    UserRegister, UserLogin, VerifyLoginOTP, ForgotPassword, ResetPassword, ChangePassword,
    TokenResponse, UserResponse, MessageResponse,
    RefreshTokenRequest, RefreshTokenResponse,
)
from app.utils.security import (
    create_access_token, create_refresh_token,
    hash_password, verify_password, verify_dummy_password, verify_dummy_otp, generate_otp,
    validate_password_strength, decode_token, hash_otp, verify_otp, deny_token,
)
from app.utils.email import send_login_otp_email, send_password_reset_email, send_user_approval_email
from app.utils.audit import audit_event
from app.dependencies.auth import get_current_user, security
from app.middleware.security import limiter
from config.settings import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

def _build_token_payload(user: User) -> dict:
    """Shared JWT payload. `tv` (token_version) is enforced by get_current_user
    so we can invalidate all issued tokens on password change / reset."""
    return {
        "user_id": str(user.id),
        "email": user.email,
        "role": user.role,
        "tv": user.token_version,
    }

def _otp_locked_out(user: User) -> bool:
    return bool(
        user.otp_lockout_until
        and user.otp_lockout_until > datetime.utcnow()
    )

async def _record_otp_failure(user: User) -> None:
    """Count failed OTP attempts and trigger a per-account lockout once the
    threshold is reached. Resets the attempt counter after lockout."""
    user.otp_attempts = (user.otp_attempts or 0) + 1
    if user.otp_attempts >= settings.OTP_MAX_ATTEMPTS:
        user.otp_lockout_until = datetime.utcnow() + timedelta(
            minutes=settings.OTP_LOCKOUT_MINUTES
        )
        user.otp_attempts = 0
    await user.save()

async def _clear_otp_state(user: User, *, clear_login: bool = False, clear_reset: bool = False) -> None:
    if clear_login:
        user.login_otp = None
        user.login_otp_expires = None
    if clear_reset:
        user.password_reset_otp = None
        user.password_reset_otp_expires = None
    user.otp_attempts = 0
    user.otp_lockout_until = None
    await user.save()

def _email_domain_allowed(email: str) -> bool:
    """Optional allow-list of registrable email domains.

    Returns True when no allow-list is configured (registration is open) or
    the email's domain is in the list. Always called case-insensitively.
    """
    allowed = settings.get_allowed_domains()
    if not allowed:
        return True
    _, _, domain = (email or "").lower().partition("@")
    return any(domain == d.lower().strip() for d in allowed if d)

@router.post("/register", response_model=MessageResponse)
@limiter.limit("2/minute")
async def register(
    request: Request,
    user_data: UserRegister,
    background_tasks: BackgroundTasks,
):

    is_valid, error_msg = validate_password_strength(user_data.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )

    email = user_data.email.lower()

    generic_response = MessageResponse(
        message="Registration received. If the email is eligible, an admin will review it shortly.",
        success=True,
    )

    if not _email_domain_allowed(email):
        verify_dummy_password(user_data.password)
        return generic_response

    existing_user = await User.find_one(User.email == email)

    if existing_user:

        verify_dummy_password(user_data.password)
        return generic_response

    new_user = User(
        name=user_data.name,
        email=email,
        hashed_password=hash_password(user_data.password),
        department=user_data.department,
        auth_provider=AuthProvider.LOCAL,
        role=UserRole.RESEARCHER,
        is_active=True,
        is_verified=True,
        is_approved=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

    new_user.update_permissions_by_role()
    await new_user.insert()

    background_tasks.add_task(
        _notify_super_admins_of_registration,
        new_user_name=new_user.name,
        new_user_email=new_user.email,
        new_user_id=str(new_user.id),
        department=new_user.department or "Not specified",
    )

    return generic_response

async def _notify_super_admins_of_registration(
    *,
    new_user_name: str,
    new_user_email: str,
    new_user_id: str,
    department: str,
) -> None:
    try:
        super_admins = await User.find(
            User.role == UserRole.SUPER_ADMIN, User.is_active == True
        ).to_list()
        for admin in super_admins:
            try:
                await send_user_approval_email(
                    admin_email=admin.email,
                    admin_name=admin.name,
                    new_user_name=new_user_name,
                    new_user_email=new_user_email,
                    new_user_id=new_user_id,
                    department=department,
                )
            except Exception as e:
                print(f"[WARNING] Failed to send approval email to admin: {e}")
    except Exception as e:
        print(f"[ERROR] Failed to notify super admins of new registration: {e}")

@router.post("/login")
@limiter.limit("10/minute")
async def login(
    request: Request,
    credentials: UserLogin,
    background_tasks: BackgroundTasks,
):
    user = await User.find_one(User.email == credentials.email.lower())
    if not user or not user.hashed_password:

        verify_dummy_password(credentials.password)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not user.is_approved or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if _otp_locked_out(user):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed OTP attempts. Please try again later.",
        )

    otp = generate_otp()
    user.login_otp = hash_otp(otp)
    user.login_otp_expires = datetime.utcnow() + timedelta(
        minutes=settings.LOGIN_OTP_EXPIRE_MINUTES
    )
    user.otp_attempts = 0
    user.otp_lockout_until = None
    await user.save()

    background_tasks.add_task(send_login_otp_email, user.email, otp, user.name)

    return MessageResponse(
        message="If the credentials are valid, an OTP has been sent to the registered email.",
        success=True,
    )

@router.post("/verify-otp", response_model=TokenResponse)
@limiter.limit("10/minute")
async def verify_login_otp(request: Request, otp_data: VerifyLoginOTP):
    user = await User.find_one(User.email == otp_data.email.lower())
    if not user:

        verify_dummy_otp(str(otp_data.otp))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP"
        )

    if _otp_locked_out(user):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed OTP attempts. Please try again later.",
        )

    if not user.login_otp or not user.login_otp_expires:
        verify_dummy_otp(str(otp_data.otp))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP"
        )

    if user.login_otp_expires < datetime.utcnow():

        await _clear_otp_state(user, clear_login=True)
        verify_dummy_otp(str(otp_data.otp))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTP expired. Please request a new one."
        )

    if not verify_otp(str(otp_data.otp), str(user.login_otp)):
        await _record_otp_failure(user)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP"
        )

    await _clear_otp_state(user, clear_login=True)
    user.last_login = datetime.utcnow()
    await user.save()

    token_data = _build_token_payload(user)
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.from_user(user)
    )

@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    reset_request: ForgotPassword,
    background_tasks: BackgroundTasks,
):
    user = await User.find_one(User.email == reset_request.email.lower())

    generic_response = MessageResponse(
        message="If the email exists, a password reset OTP has been sent.",
        success=True
    )

    if not user or user.auth_provider != AuthProvider.LOCAL:
        verify_dummy_otp("")
        return generic_response

    otp = generate_otp()
    user.password_reset_otp = hash_otp(otp)
    user.password_reset_otp_expires = datetime.utcnow() + timedelta(
        minutes=settings.PASSWORD_RESET_OTP_EXPIRE_MINUTES
    )
    user.otp_attempts = 0
    user.otp_lockout_until = None
    await user.save()

    background_tasks.add_task(send_password_reset_email, user.email, otp, user.name)

    return generic_response

@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit("5/minute")
async def reset_password(request: Request, reset: ResetPassword):
    user = await User.find_one(User.email == reset.email.lower())
    if not user:

        verify_dummy_otp(str(reset.otp))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP"
        )

    if _otp_locked_out(user):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed OTP attempts. Please try again later.",
        )

    if not user.password_reset_otp or not user.password_reset_otp_expires:
        verify_dummy_otp(str(reset.otp))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP"
        )

    if user.password_reset_otp_expires < datetime.utcnow():
        await _clear_otp_state(user, clear_reset=True)
        verify_dummy_otp(str(reset.otp))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTP expired"
        )

    if not verify_otp(str(reset.otp), str(user.password_reset_otp)):
        await _record_otp_failure(user)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP"
        )

    is_valid, error_msg = validate_password_strength(reset.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )

    user.hashed_password = hash_password(reset.new_password)
    user.password_reset_otp = None
    user.password_reset_otp_expires = None

    user.token_version = (user.token_version or 0) + 1
    user.otp_attempts = 0
    user.otp_lockout_until = None
    user.updated_at = datetime.utcnow()
    await user.save()

    return MessageResponse(
        message="Password reset successful. You can now login with your new password.",
        success=True
    )

@router.post("/change-password", response_model=MessageResponse)
@limiter.limit("5/minute")
async def change_password(
    request: Request,
    change: ChangePassword,
    current_user: User = Depends(get_current_user)
):
    if current_user.auth_provider != AuthProvider.LOCAL or not current_user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password change is not available for this account"
        )

    if not verify_password(change.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )

    is_valid, error_msg = validate_password_strength(change.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )

    current_user.hashed_password = hash_password(change.new_password)
    current_user.token_version = (current_user.token_version or 0) + 1
    current_user.updated_at = datetime.utcnow()
    await current_user.save()

    return MessageResponse(
        message="Password changed successfully. Please log in again.",
        success=True
    )

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return UserResponse.from_user(current_user)

@router.post("/logout", response_model=MessageResponse)
async def logout(
    current_user: User = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """JWT is stateless, but we still:
      1) deny the just-used access token's `jti` until its `exp` (so an
         attacker who already exfiltrated the bearer can't replay it during
         the access-token's remaining lifetime), and
      2) bump `token_version` so any refresh token in flight is rejected.
    """
    payload = decode_token(credentials.credentials) or {}
    jti = payload.get("jti")
    exp_ts = payload.get("exp")
    if jti and exp_ts:
        try:
            expires_at = datetime.fromtimestamp(int(exp_ts), tz=timezone.utc)
            await deny_token(jti, expires_at)
        except Exception as e:

            print(f"[WARNING] deny_token failed during logout: {type(e).__name__}")

    current_user.token_version = (current_user.token_version or 0) + 1
    current_user.updated_at = datetime.utcnow()
    await current_user.save()
    audit_event(
        "auth.logout",
        actor_id=str(current_user.id),
        actor_role=current_user.role,
    )
    return MessageResponse(
        message="Logged out successfully.",
        success=True
    )

@router.post("/refresh", response_model=RefreshTokenResponse)
@limiter.limit("30/minute")
async def refresh_token(request: Request, body: RefreshTokenRequest):
    """Exchange a refresh token for a new access token.

    Security properties:
      - Only refresh-typed JWTs are accepted.
      - The `tv` claim must still match the user's current `token_version`,
        so password change / reset / logout revokes refresh tokens too.
      - We rotate the refresh token on every call so a leaked refresh token
        is usable at most once before the legitimate client invalidates it.
    """
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user = await User.get(user_id)
    if not user or not user.is_active or not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    if payload.get("tv", 0) != user.token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked",
        )

    user.token_version = (user.token_version or 0) + 1
    user.updated_at = datetime.utcnow()
    await user.save()

    token_data = _build_token_payload(user)
    new_access = create_access_token(token_data)
    new_refresh = create_refresh_token(token_data)

    return RefreshTokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
