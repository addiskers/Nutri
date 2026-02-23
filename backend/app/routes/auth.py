"""
Authentication Routes - Dual Authentication (Azure AD SSO + Email/Password)
"""
from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timedelta
import secrets
from app.models.user import User, UserRole, AuthProvider
from app.schemas.auth import (
    UserRegister, UserLogin, VerifyLoginOTP, ForgotPassword, ResetPassword, ChangePassword,
    AzureAuthRequest, AzureAuthUrlResponse,
    TokenResponse, UserResponse, MessageResponse
)
from app.utils.security import (
    create_access_token, create_refresh_token, 
    hash_password, verify_password, generate_otp, validate_password_strength
)
from app.utils.azure_auth import AzureADAuth
from app.utils.email import send_login_otp_email, send_password_reset_email, send_user_approval_email
from app.dependencies.auth import get_current_user
from config.settings import settings

# Initialize Azure AD authentication
azure_auth = AzureADAuth()

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ============================================================
# TRADITIONAL EMAIL/PASSWORD AUTHENTICATION
# ============================================================

@router.post("/register", response_model=MessageResponse)
async def register(user_data: UserRegister):
    """
    Register new user with email and password
    
    - Creates user account (pending admin approval)
    - Sends approval notification to admins
    """
    # Check if user already exists
    existing_user = await User.find_one(User.email == user_data.email.lower())
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    # Validate password strength
    is_valid, error_msg = validate_password_strength(user_data.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Create new user
    new_user = User(
        name=user_data.name,
        email=user_data.email.lower(),
        hashed_password=hash_password(user_data.password),
        department=user_data.department,
        auth_provider=AuthProvider.LOCAL,
        role=UserRole.RESEARCHER,
        is_active=True,
        is_verified=True,
        is_approved=False,  # Requires admin approval
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    new_user.update_permissions_by_role()
    await new_user.insert()
    
    # Send approval email to all super admins
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
    """
    Login with email and password
    
    - Verifies credentials
    - Sends OTP to email for 2FA
    """
    # Find user
    user = await User.find_one(User.email == credentials.email.lower())
    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Verify password
    if not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Check if account is approved
    if not user.is_approved:
        print(f"[WARNING] User {user.email} not approved yet")
        return MessageResponse(
            message="Your account is pending admin approval",
            success=False
        )
    
    # Check if account is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated"
        )
    
    # Generate and store OTP
    print(f"[INFO] Generating OTP for {user.email}")
    otp = generate_otp()
    user.reset_token = otp
    user.reset_token_expires = datetime.utcnow() + timedelta(minutes=10)
    await user.save()
    
    # Send OTP email
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
    """
    Verify login OTP and issue JWT tokens
    """
    # Find user
    user = await User.find_one(User.email == otp_data.email.lower())
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Verify OTP
    if not user.reset_token or user.reset_token != otp_data.otp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP"
        )
    
    # Check OTP expiration
    if not user.reset_token_expires or user.reset_token_expires < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTP expired. Please request a new one."
        )
    
    # Clear OTP
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
    if not user or user.auth_provider != AuthProvider.EMAIL:
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
    if current_user.auth_provider != AuthProvider.EMAIL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password change not available for Azure AD users"
        )
    
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


# ============================================================
# AZURE AD SSO AUTHENTICATION
# ============================================================


@router.get("/azure/login", response_model=AzureAuthUrlResponse)
async def azure_login():
    """
    Initiate Azure AD login flow
    
    Returns Azure AD authorization URL for user to authenticate
    """
    # Generate CSRF state token
    state = secrets.token_urlsafe(32)
    
    # Get Azure AD authorization URL
    auth_data = azure_auth.get_authorization_url(state=state)
    
    return AzureAuthUrlResponse(
        auth_url=auth_data["auth_url"],
        state=state
    )


@router.post("/azure/callback")
async def azure_callback(request: AzureAuthRequest):
    """
    Handle Azure AD OAuth callback
    
    - **code**: Authorization code from Azure AD
    - **state**: CSRF protection state (optional)
    
    Returns JWT tokens if user is approved, or pending message if not
    """
    # Exchange authorization code for access token
    token_result = await azure_auth.exchange_code_for_token(request.code)
    
    if not token_result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to authenticate with Azure AD"
        )
    
    # Get user information from Microsoft Graph
    access_token = token_result.get("access_token")
    user_info = await azure_auth.get_user_info(access_token)
    
    if not user_info or not user_info.get("email"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to retrieve user information from Azure AD"
        )
    
    email = user_info["email"].lower()
    azure_id = user_info["azure_id"]
    name = user_info["name"]
    
    # Validate email domain if restrictions are set
    if not azure_auth.validate_email_domain(email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Email domain not allowed. Please use your organization email."
        )
    
    # Check if user exists by azure_id or email
    user = await User.find_one(User.azure_id == azure_id)
    if not user:
        user = await User.find_one(User.email == email)
    
    # Determine if this is a super admin email
    is_super_admin = azure_auth.is_super_admin_email(email)
    
    if not user:
        # Create new user
        print(f"[INFO] Creating new user from Azure AD: {email}")
        
        user = User(
            name=name,
            email=email,
            azure_id=azure_id,
            auth_provider=AuthProvider.AZURE_AD,
            department=user_info.get("department"),
            job_title=user_info.get("job_title"),
            role=UserRole.SUPER_ADMIN if is_super_admin else UserRole.RESEARCHER,
            is_active=True,
            is_verified=True,
            is_approved=is_super_admin,  # Auto-approve super admins
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Set permissions based on role
        user.update_permissions_by_role()
        
        # Save to database
        await user.insert()
        
        print(f"[INFO] User created: {email} (Role: {user.role}, Approved: {user.is_approved})")
    else:
        # Update existing user with latest Azure AD info
        user.azure_id = azure_id
        user.name = name
        user.email = email
        user.department = user_info.get("department") or user.department
        user.job_title = user_info.get("job_title") or user.job_title
        user.auth_provider = AuthProvider.AZURE_AD
        user.updated_at = datetime.utcnow()
        
        # If user is in super admin list and not yet approved, approve them
        if is_super_admin and not user.is_approved:
            user.is_approved = True
            user.role = UserRole.SUPER_ADMIN
            user.update_permissions_by_role()
            print(f"[INFO] Auto-approved super admin: {email}")
        
        await user.save()
        print(f"[INFO] User updated from Azure AD: {email}")
    
    # Check if user is approved
    if not user.is_approved:
        return MessageResponse(
            message="Your account is pending approval by an administrator. Please wait for approval notification.",
            success=False
        )
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact administrator."
        )
    
    # Update last login
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
    
    print(f"[INFO] User logged in successfully: {email}")
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.from_user(user)
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
    Azure AD session remains active for compliance and SSO purposes.
    """
    print(f"[INFO] User logged out: {current_user.email}")
    return MessageResponse(
        message="Logged out successfully. Please close your browser to end Azure AD session.",
        success=True
    )
