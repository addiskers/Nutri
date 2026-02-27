from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timedelta
from app.models.user import User, UserRole
from app.schemas.auth import (
    UserRegister, UserLogin, VerifyLoginOTP, ForgotPassword, ResetPassword, ChangePassword,
    TokenResponse, UserResponse, MessageResponse
)
from app.utils.security import (
    create_access_token, create_refresh_token, 
    hash_password, verify_password, generate_otp, validate_password_strength
)
from app.utils.email import send_login_otp_email, send_password_reset_email, send_user_approval_email
from app.dependencies.auth import get_current_user
from config.settings import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=MessageResponse)
async def register(user_data: UserRegister):
    existing_user = await User.find_one(User.email == user_data.email.lower())
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    is_valid, error_msg = validate_password_strength(user_data.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    new_user = User(
        name=user_data.name,
        email=user_data.email.lower(),
        hashed_password=hash_password(user_data.password),
        department=user_data.department,
        role=UserRole.RESEARCHER,
        is_active=True,
        is_verified=True,
        is_approved=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    new_user.update_permissions_by_role()
    await new_user.insert()
    
    try:
        super_admins = await User.find(User.role == UserRole.SUPER_ADMIN, User.is_active == True).to_list()
        print(f"[INFO] Found {len(super_admins)} super admins to notify")
        
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
                print(f"[SUCCESS] Approval email sent to admin: {admin.email}")
            except Exception as e:
                print(f"[WARNING] Failed to send approval email to {admin.email}: {e}")
    except Exception as e:
        print(f"[ERROR] Failed to get super admins or send emails: {e}")
    
    print(f"[INFO] New user registered: {new_user.email}")
    
    return MessageResponse(
        message="Registration successful! Your account is pending admin approval.",
        success=True
    )


@router.post("/login")
async def login(credentials: UserLogin):
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
        print(f"[WARNING] User {user.email} not approved yet")
        return MessageResponse(
            message="Your account is pending admin approval",
            success=False
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated"
        )
    
    print(f"[INFO] Generating OTP for {user.email}")
    otp = generate_otp()
    user.reset_token = otp
    user.reset_token_expires = datetime.utcnow() + timedelta(minutes=10)
    await user.save()
    
    try:
        await send_login_otp_email(user.email, otp, user.name)
        print(f"[SUCCESS] OTP email sent to {user.email}")
    except Exception as e:
        print(f"[ERROR] Failed to send OTP email: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send OTP email. Please try again."
        )
    
    print(f"[INFO] Login OTP sent to: {user.email}")
    
    return MessageResponse(
        message=f"OTP sent to {user.email}. Please verify to continue.",
        success=True
    )


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_login_otp(otp_data: VerifyLoginOTP):
    user = await User.find_one(User.email == otp_data.email.lower())
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not user.reset_token or user.reset_token != otp_data.otp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP"
        )
    
    if not user.reset_token_expires or user.reset_token_expires < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTP expired. Please request a new one."
        )
    
    user.reset_token = None
    user.reset_token_expires = None
    user.last_login = datetime.utcnow()
    await user.save()
    
    # Create JWT tokens
    token_data = {
        "user_id": str(user.id),
        "email": user.email,
        "role": user.role
    }
    
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    print(f"[INFO] User logged in: {user.email}")
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.from_user(user)
    )


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(request: ForgotPassword):
    """
    Request password reset OTP
    """
    user = await User.find_one(User.email == request.email.lower())
    if not user:
        # Don't reveal if user exists
        return MessageResponse(
            message="If the email exists, a password reset OTP has been sent.",
            success=True
        )
    
    # Generate OTP
    otp = generate_otp()
    user.reset_token = otp
    user.reset_token_expires = datetime.utcnow() + timedelta(hours=settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS)
    await user.save()
    
    # Send email
    try:
        await send_password_reset_email(user.email, user.name, otp)
    except Exception as e:
        print(f"[ERROR] Failed to send password reset email: {e}")
    
    print(f"[INFO] Password reset OTP sent to: {user.email}")
    
    return MessageResponse(
        message="If the email exists, a password reset OTP has been sent.",
        success=True
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(request: ResetPassword):
    """
    Reset password using OTP
    """
    user = await User.find_one(User.email == request.email.lower())
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Verify OTP
    if not user.reset_token or user.reset_token != request.otp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP"
        )
    
    # Check expiration
    if not user.reset_token_expires or user.reset_token_expires < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTP expired"
        )
    
    # Validate new password
    is_valid, error_msg = validate_password_strength(request.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Update password
    user.hashed_password = hash_password(request.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    user.updated_at = datetime.utcnow()
    await user.save()
    
    print(f"[INFO] Password reset for: {user.email}")
    
    return MessageResponse(
        message="Password reset successful. You can now login with your new password.",
        success=True
    )


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    request: ChangePassword,
    current_user: User = Depends(get_current_user)
):
    """
    Change password for authenticated user
    """
    # Verify current password
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )
    
    # Validate new password
    is_valid, error_msg = validate_password_strength(request.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Update password
    current_user.hashed_password = hash_password(request.new_password)
    current_user.updated_at = datetime.utcnow()
    await current_user.save()
    
    print(f"[INFO] Password changed for: {current_user.email}")
    
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
    print(f"[INFO] User logged out: {current_user.email}")
    return MessageResponse(
        message="Logged out successfully",
        success=True
    )
