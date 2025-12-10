"""
FastAPI Dependencies for Authentication

Provides dependency injection functions for securing API routes:
- get_current_user: Validates JWT and returns current user
- require_role: Checks user has required role
- require_permission: Checks user has required permission
- require_tier: Checks user has required subscription tier
"""
from typing import Optional, List
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.auth import (
    User,
    UserRole,
    SubscriptionTier,
    TokenData,
    verify_access_token,
    extract_token_from_header,
    has_permission,
    get_demo_user,
)
from app.logging.logger import get_logger

logger = get_logger("auth.dependencies")

# HTTP Bearer security scheme
security = HTTPBearer(auto_error=False)


# =============================================================================
# Core Authentication Dependencies
# =============================================================================

async def get_token_data(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[TokenData]:
    """
    Extract and validate token from request.

    Returns TokenData if valid token, None if no token provided.
    Raises 401 if token is invalid.
    """
    if not credentials:
        return None

    token_data = verify_access_token(credentials.credentials)

    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token_data


async def get_current_user(
    token_data: Optional[TokenData] = Depends(get_token_data),
) -> Optional[User]:
    """
    Get current authenticated user.

    Returns User if authenticated, None if no token provided.
    Use this for optional authentication.
    """
    if not token_data:
        return None

    # In production, fetch user from database
    # For demo, use mock user store
    user = await get_demo_user(token_data.user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    logger.debug(
        "User authenticated",
        extra_data={"user_id": user.id, "role": user.role.value}
    )

    return user


async def require_auth(
    user: Optional[User] = Depends(get_current_user),
) -> User:
    """
    Require authentication.

    Returns User if authenticated.
    Raises 401 if not authenticated.
    """
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


# =============================================================================
# Role-Based Dependencies
# =============================================================================

def require_role(allowed_roles: List[UserRole]):
    """
    Dependency factory to require specific roles.

    Usage:
        @router.get("/admin", dependencies=[Depends(require_role([UserRole.ADMIN]))])

    Args:
        allowed_roles: List of roles allowed to access the endpoint

    Returns:
        Dependency function that validates user role
    """
    async def role_checker(user: User = Depends(require_auth)) -> User:
        if user.role not in allowed_roles:
            logger.warning(
                "Role access denied",
                extra_data={
                    "user_id": user.id,
                    "user_role": user.role.value,
                    "required_roles": [r.value for r in allowed_roles],
                }
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {', '.join(r.value for r in allowed_roles)}",
            )
        return user

    return role_checker


def require_permission(permission: str):
    """
    Dependency factory to require specific permission.

    Usage:
        @router.post("/strategies", dependencies=[Depends(require_permission("strategies:write"))])

    Args:
        permission: Permission string (e.g., "strategies:write")

    Returns:
        Dependency function that validates user permission
    """
    async def permission_checker(user: User = Depends(require_auth)) -> User:
        if not has_permission(user.role, permission):
            logger.warning(
                "Permission denied",
                extra_data={
                    "user_id": user.id,
                    "user_role": user.role.value,
                    "required_permission": permission,
                }
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required permission: {permission}",
            )
        return user

    return permission_checker


def require_tier(min_tier: SubscriptionTier):
    """
    Dependency factory to require minimum subscription tier.

    Usage:
        @router.get("/premium", dependencies=[Depends(require_tier(SubscriptionTier.PRO))])

    Args:
        min_tier: Minimum subscription tier required

    Returns:
        Dependency function that validates subscription tier
    """
    tier_order = {
        SubscriptionTier.FREE: 0,
        SubscriptionTier.STARTER: 1,
        SubscriptionTier.PRO: 2,
        SubscriptionTier.ELITE: 3,
    }

    async def tier_checker(user: User = Depends(require_auth)) -> User:
        user_tier_level = tier_order.get(user.subscription_tier, 0)
        required_tier_level = tier_order.get(min_tier, 0)

        if user_tier_level < required_tier_level:
            logger.warning(
                "Subscription tier access denied",
                extra_data={
                    "user_id": user.id,
                    "user_tier": user.subscription_tier.value,
                    "required_tier": min_tier.value,
                }
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Upgrade required: {min_tier.value} tier or higher",
            )
        return user

    return tier_checker


# =============================================================================
# Admin Dependencies
# =============================================================================

async def require_admin(user: User = Depends(require_auth)) -> User:
    """
    Require admin role.

    Shortcut for require_role([UserRole.ADMIN]).
    """
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


# =============================================================================
# Rate Limiting Dependencies (placeholder for Redis-based implementation)
# =============================================================================

async def check_rate_limit(
    request: Request,
    user: Optional[User] = Depends(get_current_user),
):
    """
    Check rate limit for current user/IP.

    In production, this would use Redis to track request counts.
    For now, this is a placeholder that always passes.
    """
    # TODO: Implement Redis-based rate limiting
    # key = f"rate_limit:{user.id if user else request.client.host}"
    # count = await redis.incr(key)
    # if count == 1:
    #     await redis.expire(key, 60)  # 1 minute window
    # if count > limit:
    #     raise HTTPException(status_code=429, detail="Rate limit exceeded")
    pass


# =============================================================================
# WebSocket Authentication
# =============================================================================

async def get_ws_user(token: Optional[str]) -> Optional[User]:
    """
    Get user from WebSocket token.

    Used for WebSocket authentication where we can't use standard dependencies.

    Args:
        token: JWT token from query param or first message

    Returns:
        User if valid token, None otherwise
    """
    if not token:
        return None

    token_data = verify_access_token(token)

    if not token_data:
        return None

    user = await get_demo_user(token_data.user_id)

    return user
