"""
Simple test server - no custom logging to avoid blocking issues.
Run with: python simple_server.py
"""
import os
import sys

# Disable custom Loki logging for this test
os.environ["LOKI_URL"] = ""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import the webhooks router
from app.api.webhooks import router as webhooks_router

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
    print("\n" + "="*50)
    print("JadeTrade Bot Engine - Test Server")
    print("="*50)
    print("\nEndpoints:")
    print("  - API Docs:     http://localhost:8000/docs")
    print("  - Health:       http://localhost:8000/health")
    print("  - Webhook Test: http://localhost:8000/webhooks/test")
    print("  - TradingView:  http://localhost:8000/webhooks/tradingview")
    print("\n" + "="*50 + "\n")
    sys.stdout.flush()

    uvicorn.run(app, host="0.0.0.0", port=8000)
