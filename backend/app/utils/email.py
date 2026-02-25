import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from jinja2 import Template
from config.settings import settings


async def send_email(to_email: str, subject: str, html_content: str) -> bool:
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print("[WARNING] Email configuration not set. Email not sent.")
        print(f"[DEBUG] SMTP_USER: {settings.SMTP_USER}")
        print(f"[DEBUG] SMTP_PASSWORD: {'*' * len(settings.SMTP_PASSWORD) if settings.SMTP_PASSWORD else 'None'}")
        return False
    
    try:
        print(f"[INFO] Attempting to send email to: {to_email}")
        print(f"[INFO] Using SMTP: {settings.SMTP_HOST}:{settings.SMTP_PORT}")
        print(f"[INFO] From: {settings.FROM_EMAIL}")
        
        message = MIMEMultipart("alternative")
        message["From"] = f"{settings.FROM_NAME} <{settings.FROM_EMAIL}>"
        message["To"] = to_email
        message["Subject"] = subject
        
        html_part = MIMEText(html_content, "html")
        message.attach(html_part)
        
        print("[INFO] Connecting to SMTP server...")
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True  
        )
        
        print(f"[SUCCESS] Email sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to send email: {type(e).__name__}")
        print(f"[ERROR] Error details: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


async def send_password_reset_email(to_email: str, reset_token: str, user_name: str) -> bool:
    otp_code = reset_token  # Now this is a 5-digit OTP
    
    html_template = Template("""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'IBM Plex Sans', Arial, sans-serif; line-height: 1.6; color: #0f1729; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #009da5 0%, #b455a0 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: white; padding: 30px; border: 1px solid #e1e7ef; border-top: none; border-radius: 0 0 8px 8px; }
            .otp-box { background: #f9fafb; border: 2px dashed #b455a0; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .otp-code { font-size: 36px; font-weight: bold; color: #b455a0; letter-spacing: 8px; font-family: 'Courier New', monospace; }
            .footer { text-align: center; padding: 20px; color: #65758b; font-size: 12px; }
            .warning { background: #fef7e1; border-left: 4px solid #e7b008; padding: 12px; margin: 15px 0; border-radius: 4px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Password Reset OTP</h1>
            </div>
            <div class="content">
                <h2>Hello {{ user_name }},</h2>
                <p>You requested to reset your password for your NutriEyeQ Dashboard account.</p>
                <p>Use this One-Time Password (OTP) to reset your password:</p>
                
                <div class="otp-box">
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #65758b;">Your OTP Code:</p>
                    <div class="otp-code">{{ otp_code }}</div>
                </div>
                
                <p style="text-align: center; font-size: 14px; color: #65758b;">
                    Enter this code on the password reset page along with your new password.
                </p>
                
                <div class="warning">
                    <strong>Security Notice:</strong>
                    <ul style="margin: 5px 0; padding-left: 20px;">
                        <li>This OTP will expire in {{ expire_hours }} hours</li>
                        <li>If you didn't request this, please ignore this email</li>
                        <li>Never share this OTP with anyone</li>
                    </ul>
                </div>
                
                <p style="color: #65758b; font-size: 14px; margin-top: 20px;">
                    Best regards,<br>
                    The NutriEyeQ Team
                </p>
            </div>
            <div class="footer">
                <p>© 2026 Zydus Wellness - NutriEyeQ Dashboard</p>
                <p>This is an automated email. Please do not reply.</p>
            </div>
        </div>
    </body>
    </html>
    """)
    
    html_content = html_template.render(
        user_name=user_name,
        otp_code=otp_code,
        expire_hours=settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS
    )
    
    subject = "Your NutriEyeQ Password Reset OTP"
    
    return await send_email(to_email, subject, html_content)


async def send_welcome_email(to_email: str, user_name: str, temp_password: str) -> bool:
    login_link = f"{settings.FRONTEND_URL}/login"
    
    html_template = Template("""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'IBM Plex Sans', Arial, sans-serif; line-height: 1.6; color: #0f1729; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #009da5 0%, #b455a0 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: white; padding: 30px; border: 1px solid #e1e7ef; border-top: none; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #b455a0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
            .credentials { background: #f9fafb; padding: 15px; border-radius: 6px; border-left: 4px solid #009da5; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; color: #65758b; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 Welcome to NutriEyeQ!</h1>
            </div>
            <div class="content">
                <h2>Hello {{ user_name }},</h2>
                <p>Your NutriEyeQ Dashboard account has been created successfully!</p>
                
                <div class="credentials">
                    <p><strong>Your Login Credentials:</strong></p>
                    <p>📧 <strong>Email:</strong> {{ email }}</p>
                    <p>🔑 <strong>Temporary Password:</strong> <code style="background: white; padding: 4px 8px; border-radius: 4px;">{{ temp_password }}</code></p>
                </div>
                
                <p>⚠️ <strong>Important:</strong> Please change your password after your first login for security.</p>
                
                <div style="text-align: center;">
                    <a href="{{ login_link }}" class="button">Login to Dashboard</a>
                </div>
                
                <p style="color: #65758b; font-size: 14px; margin-top: 20px;">
                    Best regards,<br>
                    The NutriEyeQ Team
                </p>
            </div>
            <div class="footer">
                <p>© 2026 Zydus Wellness - NutriEyeQ Dashboard</p>
                <p>This is an automated email. Please do not reply.</p>
            </div>
        </div>
    </body>
    </html>
    """)
    
    html_content = html_template.render(
        user_name=user_name,
        email=to_email,
        temp_password=temp_password,
        login_link=login_link
    )
    
    subject = "🎉 Welcome to NutriEyeQ Dashboard"
    
    return await send_email(to_email, subject, html_content)


async def send_user_approval_email(admin_email: str, admin_name: str, new_user_name: str, 
                                   new_user_email: str, new_user_id: str, department: str) -> bool:
    approval_link = f"{settings.FRONTEND_URL}/users?approve={new_user_id}"
    
    html_template = Template("""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'IBM Plex Sans', Arial, sans-serif; line-height: 1.6; color: #0f1729; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #009da5 0%, #b455a0 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: white; padding: 30px; border: 1px solid #e1e7ef; border-top: none; border-radius: 0 0 8px 8px; }
            .user-info { background: #f9fafb; padding: 15px; border-radius: 6px; border-left: 4px solid #b455a0; margin: 15px 0; }
            .button { display: inline-block; background: #009da5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
            .footer { text-align: center; padding: 20px; color: #65758b; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>New User Registration - Approval Required</h1>
            </div>
            <div class="content">
                <h2>Hello {{ admin_name }},</h2>
                <p>A new user has registered and is waiting for your approval:</p>
                
                <div class="user-info">
                    <p><strong>Name:</strong> {{ new_user_name }}</p>
                    <p><strong>Email:</strong> {{ new_user_email }}</p>
                    <p><strong>Department:</strong> {{ department }}</p>
                    <p><strong>Requested Role:</strong> Researcher</p>
                </div>
                
                <p>Please review and approve this user in the NutriEyeQ Dashboard.</p>
                
                <div style="text-align: center;">
                    <a href="{{ approval_link }}" class="button">Review & Approve User</a>
                </div>
                
                <p style="color: #65758b; font-size: 14px; margin-top: 20px;">
                    Or login to the dashboard and go to Users page to approve.<br><br>
                    Best regards,<br>
                    NutriEyeQ System
                </p>
            </div>
            <div class="footer">
                <p>© 2026 Zydus Wellness - NutriEyeQ Dashboard</p>
                <p>This is an automated email. Please do not reply.</p>
            </div>
        </div>
    </body>
    </html>
    """)
    
    html_content = html_template.render(
        admin_name=admin_name,
        new_user_name=new_user_name,
        new_user_email=new_user_email,
        department=department,
        approval_link=approval_link
    )
    
    subject = "New User Registration - Approval Required"
    
    return await send_email(admin_email, subject, html_content)


async def send_login_otp_email(to_email: str, otp_code: str, user_name: str) -> bool:
    html_template = Template("""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'IBM Plex Sans', Arial, sans-serif; line-height: 1.6; color: #0f1729; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #009da5 0%, #b455a0 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: white; padding: 30px; border: 1px solid #e1e7ef; border-top: none; border-radius: 0 0 8px 8px; }
            .otp-box { background: #f9fafb; border: 2px dashed #009da5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .otp-code { font-size: 36px; font-weight: bold; color: #009da5; letter-spacing: 8px; font-family: 'Courier New', monospace; }
            .footer { text-align: center; padding: 20px; color: #65758b; font-size: 12px; }
            .warning { background: #fef7e1; border-left: 4px solid #e7b008; padding: 12px; margin: 15px 0; border-radius: 4px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Login Verification OTP</h1>
            </div>
            <div class="content">
                <h2>Hello {{ user_name }},</h2>
                <p>A login attempt was made on your NutriEyeQ Dashboard account.</p>
                <p>Use this One-Time Password (OTP) to complete your login:</p>
                
                <div class="otp-box">
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #65758b;">Your Login OTP:</p>
                    <div class="otp-code">{{ otp_code }}</div>
                </div>
                
                <p style="text-align: center; font-size: 14px; color: #65758b;">
                    Enter this code on the login page to verify your identity.
                </p>
                
                <div class="warning">
                    <strong>Security Notice:</strong>
                    <ul style="margin: 5px 0; padding-left: 20px;">
                        <li>This OTP will expire in 10 minutes</li>
                        <li>If you didn't attempt to login, please change your password immediately</li>
                        <li>Never share this OTP with anyone</li>
                    </ul>
                </div>
                
                <p style="color: #65758b; font-size: 14px; margin-top: 20px;">
                    Best regards,<br>
                    The NutriEyeQ Team
                </p>
            </div>
            <div class="footer">
                <p>&copy; 2026 Zydus Wellness - NutriEyeQ Dashboard</p>
                <p>This is an automated email. Please do not reply.</p>
            </div>
        </div>
    </body>
    </html>
    """)
    
    html_content = html_template.render(
        user_name=user_name,
        otp_code=otp_code
    )
    
    subject = "Your NutriEyeQ Login Verification OTP"
    
    return await send_email(to_email, subject, html_content)

