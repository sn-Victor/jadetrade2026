"""
Demo server with Redis queue, AI Chat, and WebSocket integration.
Shows the full signal flow: webhook -> queue -> worker
Plus AI chatbot and real-time updates.
"""
import os
import asyncio

os.environ["LOKI_URL"] = ""  # Disable Loki for demo

import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as redis

from app.api.webhooks import router as webhooks_router, set_signal_queue
from app.api.chat import router as chat_router
from app.api.websocket import router as ws_router
from app.api.auth import router as auth_router
from app.core.queue import SignalQueue


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Setup and teardown"""
    print("\n[STARTUP] Connecting to Redis...")
    redis_client = redis.from_url("redis://localhost:6379", decode_responses=True)

    try:
        await redis_client.ping()
        print("[STARTUP] Redis connected!")
    except Exception as e:
        print(f"[STARTUP] Redis connection failed: {e}")
        print("[STARTUP] Continuing without queue (signals won't be queued)")
        redis_client = None

    if redis_client:
        queue = SignalQueue(redis_client)
        set_signal_queue(queue)
        print("[STARTUP] Signal queue initialized!")

    # Check AI configuration
    if os.getenv("ANTHROPIC_API_KEY"):
        print("[STARTUP] Anthropic API key configured - AI Chat ready!")
    else:
        print("[STARTUP] No ANTHROPIC_API_KEY - AI Chat will use demo mode")

    print("[STARTUP] WebSocket server ready!")

    yield

    if redis_client:
        await redis_client.close()
        print("[SHUTDOWN] Redis disconnected")


app = FastAPI(
    title="JadeTrade Bot Engine - Demo",
    description="Demo server with Redis queue, AI Chat, and WebSocket",
    version="1.0.0",
    lifespan=lifespan,
)

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
        "features": ["webhooks", "redis_queue", "ai_chat", "websocket"],
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


# Include routers
app.include_router(auth_router)
app.include_router(webhooks_router)
app.include_router(chat_router)
app.include_router(ws_router)

if __name__ == "__main__":
    print("\n" + "="*60)
    print("JadeTrade Bot Engine - Demo Server")
    print("="*60)
    print("\nEndpoints:")
    print("  - API Docs:      http://localhost:8000/docs")
    print("  - Health:        http://localhost:8000/health")
    print("\nWebhooks:")
    print("  - Queue Stats:   GET  http://localhost:8000/webhooks/queue/stats")
    print("  - TradingView:   POST http://localhost:8000/webhooks/tradingview")
    print("\nAI Chat:")
    print("  - Chat:          POST http://localhost:8000/chat/")
    print("  - Chat Stream:   POST http://localhost:8000/chat/stream")
    print("  - Chat Demo:     POST http://localhost:8000/chat/demo")
    print("  - Chat Health:   GET  http://localhost:8000/chat/health")
    print("\nWebSocket:")
    print("  - Connect:       ws://localhost:8000/ws/connect?user_id=demo")
    print("  - Stats:         GET  http://localhost:8000/ws/stats")
    print("\nAuthentication:")
    print("  - Login:         POST http://localhost:8000/auth/login")
    print("  - Refresh:       POST http://localhost:8000/auth/refresh")
    print("  - Me:            GET  http://localhost:8000/auth/me")
    print("  - Demo Creds:    GET  http://localhost:8000/auth/demo-credentials")
    print("\nTest Pages:")
    print("  - Chat UI:       Open chat_test.html in browser")
    print("  - WebSocket UI:  Open ws_test.html in browser")
    print("\n" + "="*60 + "\n")

    uvicorn.run(app, host="0.0.0.0", port=8000)
