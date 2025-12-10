from pydantic_settings import BaseSettings
from typing import Optional
from functools import lru_cache


class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/nextrade"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # AWS Cognito (for JWT verification)
    COGNITO_REGION: str = "us-east-1"
    COGNITO_USER_POOL_ID: str = ""
    COGNITO_APP_CLIENT_ID: str = ""

    # Encryption
    ENCRYPTION_KEY: str = ""  # 32-byte hex string for AES-256

    # AI (Claude)
    ANTHROPIC_API_KEY: str = ""
    AI_MODEL: str = "claude-sonnet-4-20250514"
    AI_MAX_TOKENS: int = 4096

    # Logging
    LOKI_URL: Optional[str] = None
    LOG_LEVEL: str = "INFO"

    # Rate Limiting
    WEBHOOK_RATE_LIMIT: int = 30  # per minute
    API_RATE_LIMIT: int = 100  # per minute

    # Trading
    MAX_EXECUTION_TIME_MS: int = 5000
    DEFAULT_SLIPPAGE_PERCENT: float = 0.1

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
