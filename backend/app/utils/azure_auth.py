"""
Azure AD OAuth 2.0 Authentication Utilities
"""
import msal
import httpx
from typing import Optional, Dict, Any
from config.settings import settings


class AzureADAuth:
    """Handle Azure AD OAuth authentication"""
    
    def __init__(self):
        self.client_id = settings.AZURE_CLIENT_ID
        self.client_secret = settings.AZURE_CLIENT_SECRET
        self.authority = settings.get_azure_authority()
        self.redirect_uri = settings.AZURE_REDIRECT_URI
        # Note: openid, profile, offline_access are automatically added by MSAL
        self.scopes = ["User.Read"]
        
    def get_authorization_url(self, state: Optional[str] = None) -> Dict[str, str]:
        """
        Generate Azure AD authorization URL
        
        Args:
            state: Optional state parameter for CSRF protection
            
        Returns:
            Dictionary with auth_url and state
        """
        app = msal.ConfidentialClientApplication(
            self.client_id,
            authority=self.authority,
            client_credential=self.client_secret
        )
        
        auth_result = app.get_authorization_request_url(
            scopes=self.scopes,
            state=state,
            redirect_uri=self.redirect_uri
        )
        
        return {
            "auth_url": auth_result,
            "state": state or ""
        }
    
    async def exchange_code_for_token(self, code: str) -> Optional[Dict[str, Any]]:
        """
        Exchange authorization code for access token
        
        Args:
            code: Authorization code from Azure AD callback
            
        Returns:
            Token response with access_token, id_token, etc. or None if failed
        """
        app = msal.ConfidentialClientApplication(
            self.client_id,
            authority=self.authority,
            client_credential=self.client_secret
        )
        
        result = app.acquire_token_by_authorization_code(
            code=code,
            scopes=self.scopes,
            redirect_uri=self.redirect_uri
        )
        
        if "error" in result:
            print(f"[ERROR] Token exchange failed: {result.get('error_description')}")
            return None
            
        return result
    
    async def get_user_info(self, access_token: str) -> Optional[Dict[str, Any]]:
        """
        Get user information from Microsoft Graph API
        
        Args:
            access_token: Valid Azure AD access token
            
        Returns:
            User information dictionary or None if failed
        """
        graph_url = "https://graph.microsoft.com/v1.0/me"
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(graph_url, headers=headers)
                response.raise_for_status()
                user_data = response.json()
                
                return {
                    "azure_id": user_data.get("id"),
                    "email": user_data.get("mail") or user_data.get("userPrincipalName"),
                    "name": user_data.get("displayName"),
                    "given_name": user_data.get("givenName"),
                    "surname": user_data.get("surname"),
                    "job_title": user_data.get("jobTitle"),
                    "department": user_data.get("department"),
                    "office_location": user_data.get("officeLocation")
                }
        except httpx.HTTPError as e:
            print(f"[ERROR] Failed to fetch user info from Graph API: {str(e)}")
            return None
    
    def validate_email_domain(self, email: str) -> bool:
        """
        Validate if email domain is allowed
        
        Args:
            email: User email address
            
        Returns:
            True if domain is allowed or no restrictions set, False otherwise
        """
        allowed_domains = settings.get_allowed_domains()
        
        # If no domain restrictions, allow all
        if not allowed_domains:
            return True
        
        email_domain = email.split('@')[-1].lower()
        return email_domain in [d.lower() for d in allowed_domains]
    
    def is_super_admin_email(self, email: str) -> bool:
        """
        Check if email is in super admin whitelist
        
        Args:
            email: User email address
            
        Returns:
            True if email is whitelisted as super admin
        """
        super_admin_emails = settings.get_super_admin_emails()
        return email.lower() in super_admin_emails


azure_auth = AzureADAuth()
