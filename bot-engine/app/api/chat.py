"""
Chat API Endpoints

Provides REST and streaming endpoints for AI chat functionality.
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional
import json
import uuid

from app.logging.logger import get_logger, set_log_context, clear_log_context
from app.ai.chat_engine import get_chat_engine
from app.ai.context_builder import build_user_context, build_mock_context

router = APIRouter(prefix="/chat", tags=["chat"])
logger = get_logger("chat.api")


class ChatMessage(BaseModel):
    """A single chat message"""
    role: str = Field(..., description="Message role: user or assistant")
    content: str = Field(..., description="Message content")


class ChatRequest(BaseModel):
    """Request body for chat endpoints"""
    message: str = Field(..., min_length=1, max_length=4000, description="User's message")
    conversation_id: Optional[str] = Field(None, description="Conversation ID for history")
    history: List[ChatMessage] = Field(default_factory=list, description="Conversation history")
    user_id: Optional[str] = Field(None, description="User ID (for demo, normally from auth)")


class ChatResponse(BaseModel):
    """Response for non-streaming chat"""
    response: str
    conversation_id: str


class ConversationInfo(BaseModel):
    """Information about a conversation"""
    conversation_id: str
    message_count: int
    created_at: str


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    """
    Stream chat response using Server-Sent Events.

    Returns a stream of JSON chunks:
    - `{"content": "..."}` - Text chunk
    - `[DONE]` - Stream complete
    - `{"error": "..."}` - Error occurred

    Note: In production, this would require authentication.
    For demo purposes, we accept an optional user_id.
    """
    # Generate conversation ID if not provided
    conversation_id = request.conversation_id or str(uuid.uuid4())
    user_id = request.user_id or "demo-user"

    set_log_context(user_id=user_id, conversation_id=conversation_id)

    logger.info(
        "Chat stream request",
        extra_data={
            "message_length": len(request.message),
            "history_length": len(request.history),
        }
    )

    # Build user context
    user_context = await build_mock_context(user_id)

    # Get chat engine
    chat_engine = get_chat_engine()

    # Convert history to dict format
    history = [{"role": m.role, "content": m.content} for m in request.history]

    async def generate():
        """Generate streaming response"""
        try:
            async for chunk in chat_engine.chat(
                user_id=user_id,
                message=request.message,
                conversation_history=history,
                user_context=user_context,
                relevant_docs=[],  # Skip RAG for demo
            ):
                yield f"data: {json.dumps({'content': chunk})}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            logger.error(f"Streaming error: {e}", exc_info=True)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            clear_log_context()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Conversation-ID": conversation_id,
        }
    )


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Non-streaming chat endpoint.

    Returns complete response in a single JSON object.

    Note: In production, this would require authentication.
    For demo purposes, we accept an optional user_id.
    """
    # Generate conversation ID if not provided
    conversation_id = request.conversation_id or str(uuid.uuid4())
    user_id = request.user_id or "demo-user"

    set_log_context(user_id=user_id, conversation_id=conversation_id)

    logger.info(
        "Chat request",
        extra_data={
            "message_length": len(request.message),
            "history_length": len(request.history),
        }
    )

    try:
        # Build user context
        user_context = await build_mock_context(user_id)

        # Get response
        chat_engine = get_chat_engine()
        history = [{"role": m.role, "content": m.content} for m in request.history]

        response = await chat_engine.get_response(
            user_id=user_id,
            message=request.message,
            conversation_history=history,
            user_context=user_context,
            relevant_docs=[],  # Skip RAG for demo
        )

        return ChatResponse(
            response=response,
            conversation_id=conversation_id,
        )

    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Chat processing failed")
    finally:
        clear_log_context()


@router.get("/health")
async def chat_health():
    """
    Health check for chat service.

    Returns status of chat engine and dependencies.
    """
    status = {
        "status": "healthy",
        "chat_engine": "unknown",
        "anthropic_configured": False,
        "openai_configured": False,
    }

    # Check Anthropic API key
    import os
    if os.getenv("ANTHROPIC_API_KEY"):
        status["anthropic_configured"] = True
        status["chat_engine"] = "ready"
    else:
        status["chat_engine"] = "no_api_key"
        status["status"] = "degraded"

    # Check OpenAI API key (for embeddings)
    if os.getenv("OPENAI_API_KEY"):
        status["openai_configured"] = True

    return status


@router.post("/demo")
async def chat_demo(request: Request):
    """
    Demo endpoint that works without API keys.

    Returns a mock response for testing the chat UI.
    """
    try:
        body = await request.json()
        message = body.get("message", "")
    except:
        message = "Hello"

    # Generate a demo response
    demo_responses = {
        "hello": "Hello! I'm JadeBot, your AI trading assistant. How can I help you today?",
        "help": """I can help you with:
- **Platform Features**: Learn about subscription tiers and features
- **Trading Concepts**: Understand trading strategies and risk management
- **Your Portfolio**: Analyze your positions and P&L
- **Technical Support**: Set up API keys and webhooks

What would you like to know more about?""",
        "price": """I don't have access to real-time market data, but I can help you:
- Set up TradingView alerts to monitor prices
- Configure your trading strategies
- Understand price action concepts

Would you like help with any of these?""",
        "strategy": """Here's how to set up a trading strategy:

1. **Go to Dashboard** > Strategies > Create New
2. **Choose your exchange** (Binance or Bybit)
3. **Set your symbol** (e.g., BTCUSDT)
4. **Configure risk settings**:
   - Position size (% of portfolio)
   - Stop loss percentage
   - Take profit levels
5. **Copy the webhook URL** for TradingView

*This is for educational purposes only. Always do your own research.*""",
        "webhook": """To set up TradingView webhooks:

1. **Get your webhook URL** from JadeTrade dashboard
2. **Create alert in TradingView**
3. **Set webhook URL** in alert settings
4. **Use this JSON format**:
```json
{
  "strategy_id": "your-id",
  "secret": "your-secret",
  "symbol": "{{ticker}}",
  "action": "long_entry"
}
```

Need more details on any step?""",
    }

    # Find matching response or use default
    message_lower = message.lower()
    response = demo_responses.get("hello")  # Default

    for key, resp in demo_responses.items():
        if key in message_lower:
            response = resp
            break

    return {
        "response": response,
        "conversation_id": str(uuid.uuid4()),
        "demo": True,
    }
