from fastapi import APIRouter, HTTPException, status, Depends, Request
from datetime import datetime, timedelta, timezone


def _as_utc(dt: datetime) -> datetime:
    """Coerce a naive datetime (assumed UTC) to aware. Handles old DB documents."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)
from app.models.user import User, UserRole
from app.schemas.auth import (
    UserRegister, UserLogin, VerifyLoginOTP, ForgotPassword, ResetPassword, ChangePassword,
    RefreshTokenRequest, TokenResponse, UserResponse, MessageResponse
)
from app.utils.security import (
    create_access_token, create_refresh_token, decode_token,
    hash_password, verify_password, generate_otp, hash_otp, verify_otp,
    validate_password_strength
)
from app.utils.email import send_login_otp_email, send_password_reset_email, send_user_approval_email
from app.dependencies.auth import get_current_user
from app.middleware.security import limiter
from config.settings import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=MessageResponse)
@limiter.limit("3/minute")
async def register(request: Request, user_data: UserRegister):
    is_valid, error_msg = validate_password_strength(user_data.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )

    existing_user = await User.find_one(User.email == user_data.email.lower())
    if existing_user:
        return MessageResponse(
            message="Registration successful! Your account is pending admin approval.",
            success=True
        )
    
    # Check if this is the first user in the system
    user_count = await User.count()
    is_first_user = (user_count == 0)
    
    # First user becomes Super Admin automatically
    user_role = UserRole.SUPER_ADMIN if is_first_user else UserRole.RESEARCHER
    is_approved = True if is_first_user else False
    
    new_user = User(
        name=user_data.name,
        email=user_data.email.lower(),
        hashed_password=hash_password(user_data.password),
        department=user_data.department,
        role=user_role,
        is_active=True,
        is_verified=True,
        is_approved=is_approved,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    
    new_user.update_permissions_by_role()
    await new_user.insert()
    
    if is_first_user:
        logger.info("First user registered as Super Admin")
        return MessageResponse(
            message="Welcome! You are the first user and have been granted Super Admin privileges.",
            success=True
        )
    
    # Send approval emails to existing admins for non-first users
    try:
        super_admins = await User.find(User.role == UserRole.SUPER_ADMIN, User.is_active == True).to_list()
        logger.info("Found %d super admins to notify", len(super_admins))
        
        for admin in super_admins:
            try:
                await send_user_approval_email(
                    admin_email=admin.email,
                    admin_name=admin.name,
                    new_user_name=new_user.name,
                    new_user_email=new_user.email,
                    new_user_id=str(new_user.id),
                    department=new_user.department or "Not specified"
                )
                logger.info("Approval email sent to admin")
            except Exception as e:
                logger.warning("Failed to send approval email: %s", type(e).__name__)
    except Exception as e:
        logger.error("Failed to notify super admins: %s", type(e).__name__)
    
    logger.info("New user registered")
    
    return MessageResponse(
        message="Registration successful! Your account is pending admin approval.",
        success=True
    )


@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, credentials: UserLogin):
    user = await User.find_one(User.email == credentials.email.lower())
    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    if not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    if not user.is_approved:
        logger.warning("Login attempt by unapproved user")
        return MessageResponse(
            message="Your account is pending admin approval",
            success=False
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated"
        )
    
    otp = generate_otp()
    user.login_otp = hash_otp(otp)
    user.login_otp_expires = datetime.now(timezone.utc) + timedelta(minutes=10)
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


@router.post("/verify-otp", response_model=TokenResponse)
@limiter.limit("5/minute")
async def verify_login_otp(request: Request, otp_data: VerifyLoginOTP):
    user = await User.find_one(User.email == otp_data.email.lower())
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP"
        )
    
    if not user.login_otp or not verify_otp(otp_data.otp, user.login_otp):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP"
        )
    
    if not user.login_otp_expires or _as_utc(user.login_otp_expires) < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTP expired. Please request a new one."
        )
    
    user.login_otp = None
    user.login_otp_expires = None
    user.last_login = datetime.now(timezone.utc)
    await user.save()
    
    # Create JWT tokens
    token_data = {
        "user_id": str(user.id),
        "email": user.email,
        "role": user.role
    }
    
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    logger.info("User logged in")
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.from_user(user)
    )


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("10/minute")
async def refresh_token(request: Request, body: RefreshTokenRequest):
    """Exchange a valid refresh token for a new access + refresh token pair (rotation)."""
    payload = decode_token(body.refresh_token)
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
    }

    new_access = create_access_token(token_data)
    new_refresh = create_refresh_token(token_data)

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.from_user(user),
    )


@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit("3/minute")
async def forgot_password(request: Request, forgot_data: ForgotPassword):
    """
    Request password reset OTP
    """
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

    try:
        sent = await send_password_reset_email(user.email, otp, user.name)
        if not sent:
            user.reset_token = None
            user.reset_token_expires = None
            await user.save()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send reset email. Please try again later."
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to send password reset email: %s", type(e).__name__)
        user.reset_token = None
        user.reset_token_expires = None
        await user.save()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send reset email. Please try again later."
        )

    logger.info("Password reset OTP sent")

    return MessageResponse(
        message="If the email exists, a password reset OTP has been sent.",
        success=True
    )


@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit("5/minute")
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
    
    if not user.reset_token or not verify_otp(reset_data.otp, user.reset_token):
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
    user.updated_at = datetime.now(timezone.utc)
    await user.save()
    
    logger.info("Password reset completed")
    
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
    current_user.updated_at = datetime.now(timezone.utc)
    await current_user.save()
    
    logger.info("Password changed")
    
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
async def logout(current_user: User = Depends(get_current_user)):
    """
    Logout current user
    
    Note: JWT tokens are stateless, so this is mainly for client-side cleanup.
    """
    logger.info("User logged out")
    return MessageResponse(
        message="Logged out successfully",
        success=True
    )
