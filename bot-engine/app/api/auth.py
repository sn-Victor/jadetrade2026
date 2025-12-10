"""
Authentication API Endpoints

Provides REST endpoints for authentication:
- Login (email/password)
- Token refresh
- Logout
- Current user info
- Password change
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, status, Depends, Request
from pydantic import BaseModel, EmailStr, Field

from app.core.auth import (
    User,
    TokenPair,
    SubscriptionTier,
    create_token_pair,
    verify_refresh_token,
    create_access_token,
    authenticate_demo_user,
    get_demo_user,
    hash_password,
    verify_password,
    TIER_LIMITS,
)
from app.core.dependencies import (
    require_auth,
    get_current_user,
)
from app.logging.logger import get_logger

router = APIRouter(prefix="/auth", tags=["authentication"])
logger = get_logger("auth.api")


# =============================================================================
# Request/Response Models
# =============================================================================

class LoginRequest(BaseModel):
    """Login request body"""
    email: EmailStr = Field(..., description="User's email address")
    password: str = Field(..., min_length=6, description="User's password")


class TokenResponse(BaseModel):
    """Token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    """Token refresh request"""
    refresh_token: str = Field(..., description="Valid refresh token")


class UserResponse(BaseModel):
    """User info response"""
    id: str
    email: str
    role: str
    subscription_tier: str
    is_active: bool
    display_name: Optional[str] = None


class UserLimitsResponse(BaseModel):
    """User's current tier limits"""
    tier: str
    max_strategies: int
    max_positions: int
    max_webhooks: int
    ai_chat_daily_limit: int
    exchanges: list


class PasswordChangeRequest(BaseModel):
    """Password change request"""
    current_password: str = Field(..., min_length=6)
    new_password: str = Field(..., min_length=8, description="Min 8 characters")


# =============================================================================
# Endpoints
# =============================================================================

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """
    Authenticate user and return tokens.

    Accepts email/password and returns JWT access and refresh tokens.

    Demo credentials:
    - demo@jadetrade.com / demo123 (Premium user)
    - admin@jadetrade.com / admin123 (Admin user)
    """
    logger.info(
        "Login attempt",
        extra_data={"email": request.email}
    )

    # Authenticate user
    user = await authenticate_demo_user(request.email, request.password)

    if not user:
        logger.warning(
            "Login failed: Invalid credentials",
            extra_data={"email": request.email}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        logger.warning(
            "Login failed: Account disabled",
            extra_data={"email": request.email, "user_id": user.id}
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    # Create tokens
    token_pair = create_token_pair(
        user_id=user.id,
        email=user.email,
        role=user.role,
        subscription_tier=user.subscription_tier,
    )

    logger.info(
        "Login successful",
        extra_data={"user_id": user.id, "email": user.email}
    )

    return TokenResponse(
        access_token=token_pair.access_token,
        refresh_token=token_pair.refresh_token,
        token_type=token_pair.token_type,
        expires_in=token_pair.expires_in,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshRequest):
    """
    Refresh access token using refresh token.

    Exchange a valid refresh token for a new access/refresh token pair.
    """
    # Verify refresh token
    token_data = verify_refresh_token(request.refresh_token)

    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Get user
    user = await get_demo_user(token_data.user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    # Create new tokens
    token_pair = create_token_pair(
        user_id=user.id,
        email=user.email,
        role=user.role,
        subscription_tier=user.subscription_tier,
    )

    logger.info(
        "Token refreshed",
        extra_data={"user_id": user.id}
    )

    return TokenResponse(
        access_token=token_pair.access_token,
        refresh_token=token_pair.refresh_token,
        token_type=token_pair.token_type,
        expires_in=token_pair.expires_in,
    )


@router.post("/logout")
async def logout(user: User = Depends(require_auth)):
    """
    Logout current user.

    In production, this would invalidate the refresh token in Redis/database.
    For now, client should discard tokens.
    """
    logger.info(
        "User logged out",
        extra_data={"user_id": user.id}
    )

    # TODO: Add refresh token to blacklist in Redis
    # await redis.sadd("token_blacklist", refresh_token)
    # await redis.expire("token_blacklist", 7 * 24 * 60 * 60)  # 7 days

    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(require_auth)):
    """
    Get current authenticated user info.

    Returns user profile and subscription details.
    """
    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role.value,
        subscription_tier=user.subscription_tier.value,
        is_active=user.is_active,
        display_name=user.display_name,
    )


@router.get("/me/limits", response_model=UserLimitsResponse)
async def get_my_limits(user: User = Depends(require_auth)):
    """
    Get current user's tier limits.

    Returns the limits associated with user's subscription tier.
    """
    limits = TIER_LIMITS.get(user.subscription_tier, TIER_LIMITS[SubscriptionTier.FREE])

    return UserLimitsResponse(
        tier=user.subscription_tier.value,
        max_strategies=limits.get("max_strategies", 0),
        max_positions=limits.get("max_positions", 0),
        max_webhooks=limits.get("max_webhooks", 0),
        ai_chat_daily_limit=limits.get("ai_chat_daily_limit", 0),
        exchanges=limits.get("exchanges", []),
    )


@router.post("/change-password")
async def change_password(
    request: PasswordChangeRequest,
    user: User = Depends(require_auth),
):
    """
    Change current user's password.

    Requires current password verification.
    """
    # In demo mode, we don't actually change passwords
    # In production, verify current password and update in database

    logger.info(
        "Password change requested",
        extra_data={"user_id": user.id}
    )

    # For demo, just return success
    # TODO: Implement actual password change with database
    return {"message": "Password changed successfully (demo mode - not persisted)"}


@router.get("/verify")
async def verify_token(user: Optional[User] = Depends(get_current_user)):
    """
    Verify if current token is valid.

    Returns token status and user info if valid.
    Useful for frontend to check auth state.
    """
    if not user:
        return {
            "valid": False,
            "user": None,
        }

    return {
        "valid": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role.value,
            "subscription_tier": user.subscription_tier.value,
        },
    }


# =============================================================================
# Demo Endpoints
# =============================================================================

@router.get("/demo-credentials")
async def get_demo_credentials():
    """
    Get demo login credentials.

    For development/testing purposes only.
    Remove in production.
    """
    return {
        "demo_users": [
            {
                "email": "demo@jadetrade.com",
                "password": "demo123",
                "role": "premium",
                "tier": "pro",
            },
            {
                "email": "admin@jadetrade.com",
                "password": "admin123",
                "role": "admin",
                "tier": "elite",
            },
        ],
        "note": "Demo credentials - remove in production",
    }
