"""
Authentication & Authorization Module

Provides JWT-based authentication for the JadeTrade Bot Engine:
- JWT token generation and validation
- Password hashing and verification
- User session management
- Role-based access control (RBAC)
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from enum import Enum

from jose import JWTError, jwt
import bcrypt
from pydantic import BaseModel, EmailStr, Field

from app.logging.logger import get_logger

logger = get_logger("auth")

# Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET", "dev-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))


# =============================================================================
# Enums and Models
# =============================================================================

class UserRole(str, Enum):
    """User roles for RBAC"""
    USER = "user"
    PREMIUM = "premium"
    ADMIN = "admin"


class SubscriptionTier(str, Enum):
    """Subscription tiers"""
    FREE = "free"
    STARTER = "starter"
    PRO = "pro"
    ELITE = "elite"


class TokenType(str, Enum):
    """Token types"""
    ACCESS = "access"
    REFRESH = "refresh"


class TokenData(BaseModel):
    """Decoded token data"""
    user_id: str
    email: Optional[str] = None
    role: UserRole = UserRole.USER
    subscription_tier: SubscriptionTier = SubscriptionTier.FREE
    token_type: TokenType = TokenType.ACCESS
    exp: Optional[datetime] = None


class User(BaseModel):
    """User model for authentication context"""
    id: str
    email: EmailStr
    role: UserRole = UserRole.USER
    subscription_tier: SubscriptionTier = SubscriptionTier.FREE
    is_active: bool = True
    created_at: Optional[datetime] = None

    # Optional profile fields
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None


class TokenPair(BaseModel):
    """Access and refresh token pair"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


# =============================================================================
# Password Utilities
# =============================================================================

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    password_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)


# =============================================================================
# JWT Token Functions
# =============================================================================

def create_access_token(
    user_id: str,
    email: str,
    role: UserRole = UserRole.USER,
    subscription_tier: SubscriptionTier = SubscriptionTier.FREE,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a JWT access token.

    Args:
        user_id: Unique user identifier
        email: User's email
        role: User's role
        subscription_tier: User's subscription tier
        expires_delta: Custom expiration time (default: ACCESS_TOKEN_EXPIRE_MINUTES)

    Returns:
        Encoded JWT token string
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": user_id,
        "email": email,
        "role": role.value,
        "tier": subscription_tier.value,
        "type": TokenType.ACCESS.value,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }

    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

    logger.debug(
        "Access token created",
        extra_data={"user_id": user_id, "expires": expire.isoformat()}
    )

    return token


def create_refresh_token(
    user_id: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a JWT refresh token.

    Args:
        user_id: Unique user identifier
        expires_delta: Custom expiration time (default: REFRESH_TOKEN_EXPIRE_DAYS)

    Returns:
        Encoded JWT refresh token string
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    payload = {
        "sub": user_id,
        "type": TokenType.REFRESH.value,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }

    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

    logger.debug(
        "Refresh token created",
        extra_data={"user_id": user_id, "expires": expire.isoformat()}
    )

    return token


def create_token_pair(
    user_id: str,
    email: str,
    role: UserRole = UserRole.USER,
    subscription_tier: SubscriptionTier = SubscriptionTier.FREE,
) -> TokenPair:
    """
    Create both access and refresh tokens.

    Args:
        user_id: Unique user identifier
        email: User's email
        role: User's role
        subscription_tier: User's subscription tier

    Returns:
        TokenPair with access_token, refresh_token, and metadata
    """
    access_token = create_access_token(user_id, email, role, subscription_tier)
    refresh_token = create_refresh_token(user_id)

    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


def decode_token(token: str) -> Optional[TokenData]:
    """
    Decode and validate a JWT token.

    Args:
        token: JWT token string

    Returns:
        TokenData if valid, None if invalid or expired
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])

        user_id = payload.get("sub")
        if not user_id:
            logger.warning("Token missing user_id")
            return None

        token_type = TokenType(payload.get("type", TokenType.ACCESS.value))

        return TokenData(
            user_id=user_id,
            email=payload.get("email"),
            role=UserRole(payload.get("role", UserRole.USER.value)),
            subscription_tier=SubscriptionTier(payload.get("tier", SubscriptionTier.FREE.value)),
            token_type=token_type,
            exp=datetime.fromtimestamp(payload.get("exp", 0), tz=timezone.utc),
        )

    except JWTError as e:
        logger.warning(f"Token decode error: {e}")
        return None


def verify_access_token(token: str) -> Optional[TokenData]:
    """
    Verify an access token.

    Args:
        token: JWT access token string

    Returns:
        TokenData if valid access token, None otherwise
    """
    token_data = decode_token(token)

    if not token_data:
        return None

    if token_data.token_type != TokenType.ACCESS:
        logger.warning("Invalid token type for access verification")
        return None

    return token_data


def verify_refresh_token(token: str) -> Optional[TokenData]:
    """
    Verify a refresh token.

    Args:
        token: JWT refresh token string

    Returns:
        TokenData if valid refresh token, None otherwise
    """
    token_data = decode_token(token)

    if not token_data:
        return None

    if token_data.token_type != TokenType.REFRESH:
        logger.warning("Invalid token type for refresh verification")
        return None

    return token_data


# =============================================================================
# Role-Based Access Control (RBAC)
# =============================================================================

# Permission definitions by role
ROLE_PERMISSIONS: Dict[UserRole, List[str]] = {
    UserRole.USER: [
        "chat:read",
        "chat:write",
        "strategies:read",
        "positions:read",
        "webhooks:read",
    ],
    UserRole.PREMIUM: [
        "chat:read",
        "chat:write",
        "strategies:read",
        "strategies:write",
        "positions:read",
        "positions:write",
        "webhooks:read",
        "webhooks:write",
        "api_keys:read",
        "api_keys:write",
    ],
    UserRole.ADMIN: [
        "*",  # All permissions
    ],
}

# Tier limits
TIER_LIMITS: Dict[SubscriptionTier, Dict[str, Any]] = {
    SubscriptionTier.FREE: {
        "max_strategies": 1,
        "max_positions": 3,
        "max_webhooks": 1,
        "ai_chat_daily_limit": 10,
        "exchanges": ["binance_testnet"],
    },
    SubscriptionTier.STARTER: {
        "max_strategies": 3,
        "max_positions": 10,
        "max_webhooks": 3,
        "ai_chat_daily_limit": 50,
        "exchanges": ["binance", "bybit"],
    },
    SubscriptionTier.PRO: {
        "max_strategies": 10,
        "max_positions": 50,
        "max_webhooks": 10,
        "ai_chat_daily_limit": 200,
        "exchanges": ["binance", "bybit"],
    },
    SubscriptionTier.ELITE: {
        "max_strategies": -1,  # unlimited
        "max_positions": -1,
        "max_webhooks": -1,
        "ai_chat_daily_limit": -1,
        "exchanges": ["binance", "bybit"],
    },
}


def has_permission(role: UserRole, permission: str) -> bool:
    """
    Check if a role has a specific permission.

    Args:
        role: User's role
        permission: Permission string (e.g., "strategies:write")

    Returns:
        True if role has permission, False otherwise
    """
    permissions = ROLE_PERMISSIONS.get(role, [])

    if "*" in permissions:
        return True

    return permission in permissions


def get_tier_limit(tier: SubscriptionTier, limit_name: str) -> Any:
    """
    Get a specific limit for a subscription tier.

    Args:
        tier: Subscription tier
        limit_name: Name of the limit (e.g., "max_strategies")

    Returns:
        Limit value, or None if not defined
    """
    limits = TIER_LIMITS.get(tier, {})
    return limits.get(limit_name)


def check_tier_limit(tier: SubscriptionTier, limit_name: str, current_count: int) -> bool:
    """
    Check if a user is within their tier limit.

    Args:
        tier: Subscription tier
        limit_name: Name of the limit
        current_count: Current count to check against limit

    Returns:
        True if within limit, False if exceeded
    """
    limit = get_tier_limit(tier, limit_name)

    if limit is None:
        return True  # No limit defined

    if limit == -1:
        return True  # Unlimited

    return current_count < limit


# =============================================================================
# Helper Functions
# =============================================================================

def extract_token_from_header(authorization: Optional[str]) -> Optional[str]:
    """
    Extract token from Authorization header.

    Args:
        authorization: Authorization header value (e.g., "Bearer <token>")

    Returns:
        Token string if valid Bearer format, None otherwise
    """
    if not authorization:
        return None

    parts = authorization.split()

    if len(parts) != 2:
        return None

    scheme, token = parts

    if scheme.lower() != "bearer":
        return None

    return token


# =============================================================================
# Demo/Mock Functions (for development without database)
# =============================================================================

# In-memory user store for demo purposes
_demo_users: Dict[str, Dict[str, Any]] = {
    "demo-user": {
        "id": "demo-user",
        "email": "demo@jadetrade.com",
        "password_hash": hash_password("demo123"),
        "role": UserRole.PREMIUM,
        "subscription_tier": SubscriptionTier.PRO,
        "is_active": True,
    },
    "admin-user": {
        "id": "admin-user",
        "email": "admin@jadetrade.com",
        "password_hash": hash_password("admin123"),
        "role": UserRole.ADMIN,
        "subscription_tier": SubscriptionTier.ELITE,
        "is_active": True,
    },
}


async def authenticate_demo_user(email: str, password: str) -> Optional[User]:
    """
    Authenticate a demo user (for testing without database).

    Args:
        email: User's email
        password: Plain text password

    Returns:
        User if authenticated, None otherwise
    """
    for user_id, user_data in _demo_users.items():
        if user_data["email"] == email:
            if verify_password(password, user_data["password_hash"]):
                return User(
                    id=user_data["id"],
                    email=user_data["email"],
                    role=user_data["role"],
                    subscription_tier=user_data["subscription_tier"],
                    is_active=user_data["is_active"],
                )
            break

    return None


async def get_demo_user(user_id: str) -> Optional[User]:
    """
    Get a demo user by ID.

    Args:
        user_id: User's ID

    Returns:
        User if found, None otherwise
    """
    user_data = _demo_users.get(user_id)

    if not user_data:
        return None

    return User(
        id=user_data["id"],
        email=user_data["email"],
        role=user_data["role"],
        subscription_tier=user_data["subscription_tier"],
        is_active=user_data["is_active"],
    )
