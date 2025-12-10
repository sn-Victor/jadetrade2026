"""
Simple test server for bot engine webhooks.
Run with: python run_server.py
"""
import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Set environment variables
os.environ.setdefault("LOKI_URL", "http://localhost:3100")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("DEBUG", "true")

from app.logging.logger import get_logger
from app.api.webhooks import router as webhooks_router

logger = get_logger("server")

app = FastAPI(
    title="JadeTrade Bot Engine - Test Server",
    description="Test server for webhook endpoints",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "service": "JadeTrade Bot Engine",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


# Include webhooks router
app.include_router(webhooks_router)

if __name__ == "__main__":
    logger.info("Starting test server on http://localhost:8000")
    print("\n" + "="*50)
    print("JadeTrade Bot Engine - Test Server")
    print("="*50)
    print("\nEndpoints:")
    print("  - API Docs:     http://localhost:8000/docs")
    print("  - Health:       http://localhost:8000/health")
    print("  - Webhook Test: http://localhost:8000/webhooks/test")
    print("  - TradingView:  http://localhost:8000/webhooks/tradingview")
    print("\n" + "="*50 + "\n")

    uvicorn.run(app, host="0.0.0.0", port=8000)
