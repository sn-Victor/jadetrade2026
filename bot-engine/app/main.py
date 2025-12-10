from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import time
import uuid

from app.config import settings
from app.logging.logger import get_logger, set_log_context, clear_log_context
from app.api import webhooks, trades, positions, chat, websocket
from app.core.database import init_db, close_db
from app.core.redis import init_redis, close_redis

logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown"""
    logger.info("Starting bot engine", extra_data={"env": settings.ENVIRONMENT})

    # Initialize connections
    await init_db()
    await init_redis()

    logger.info("Bot engine started successfully")

    yield

    # Cleanup
    logger.info("Shutting down bot engine")
    await close_db()
    await close_redis()
    logger.info("Bot engine stopped")


app = FastAPI(
    title="JadeTrade Bot Engine",
    description="Low-latency trading bot engine",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)

    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

    # In production, add HSTS
    if settings.ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    return response


@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    """Add request logging and context"""
    request_id = str(uuid.uuid4())[:8]
    start_time = time.time()

    # Set logging context
    set_log_context(
        request_id=request_id,
        method=request.method,
        path=request.url.path,
    )

    try:
        response = await call_next(request)

        duration_ms = (time.time() - start_time) * 1000
        logger.info(
            f"{request.method} {request.url.path}",
            extra_data={
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
            }
        )

        return response

    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(
            f"Request failed: {str(e)}",
            exc_info=True,
            extra_data={"duration_ms": round(duration_ms, 2)}
        )
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"}
        )
    finally:
        clear_log_context()


# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "bot-engine",
        "environment": settings.ENVIRONMENT,
    }


# Include routers
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])
app.include_router(trades.router, prefix="/api/trades", tags=["trades"])
app.include_router(positions.router, prefix="/api/positions", tags=["positions"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(websocket.router, prefix="/ws", tags=["websocket"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
