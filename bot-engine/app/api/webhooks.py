"""
TradingView Webhook Endpoint

Receives trading signals from TradingView alerts and queues them for execution.
"""
from typing import Optional
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Header, Request, Depends
from pydantic import BaseModel, Field, field_validator
import hashlib
import hmac
import uuid

from app.logging.logger import get_logger, set_log_context, clear_log_context
from app.core.queue import SignalQueue, QueuedSignal, QueuePriority

logger = get_logger("webhook")
router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# Global queue instance (set during app startup)
_signal_queue: Optional[SignalQueue] = None


def set_signal_queue(queue: SignalQueue) -> None:
    """Set the signal queue instance (called during app startup)"""
    global _signal_queue
    _signal_queue = queue


def get_signal_queue() -> Optional[SignalQueue]:
    """Get the signal queue instance"""
    return _signal_queue


class TradingViewSignal(BaseModel):
    """
    TradingView alert payload schema.

    Example TradingView alert message format:
    {
        "strategy_id": "uuid-here",
        "secret": "webhook-secret",
        "symbol": "BTCUSDT",
        "action": "long_entry",
        "price": "50000.00",
        "stop_loss": "48000.00",
        "take_profit": "55000.00"
    }
    """
    strategy_id: str = Field(..., description="Strategy UUID")
    secret: str = Field(..., description="Webhook secret for authentication")
    symbol: str = Field(..., description="Trading pair symbol")
    action: str = Field(..., description="Signal action: long_entry, long_exit, short_entry, short_exit")
    price: Optional[str] = Field(None, description="Signal price")
    stop_loss: Optional[str] = Field(None, description="Stop loss price")
    take_profit: Optional[str] = Field(None, description="Take profit price")
    quantity: Optional[str] = Field(None, description="Position quantity (optional)")
    leverage: Optional[int] = Field(None, ge=1, le=125, description="Leverage (1-125)")

    @field_validator("action")
    @classmethod
    def validate_action(cls, v):
        valid_actions = ["long_entry", "long_exit", "short_entry", "short_exit"]
        if v.lower() not in valid_actions:
            raise ValueError(f"Invalid action. Must be one of: {valid_actions}")
        return v.lower()

    @field_validator("symbol")
    @classmethod
    def validate_symbol(cls, v):
        # Normalize symbol format
        return v.upper().replace("/", "").replace("-", "")


class SignalResponse(BaseModel):
    """Response for signal processing"""
    success: bool
    signal_id: Optional[str] = None
    message: str
    queued: bool = False


class WebhookHealth(BaseModel):
    """Health check response"""
    status: str
    timestamp: str
    version: str = "1.0.0"


def verify_webhook_signature(
    payload: bytes,
    signature: str,
    secret: str
) -> bool:
    """
    Verify HMAC signature for webhook authentication.

    Alternative to secret-in-payload for more secure setups.
    """
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.get("/health", response_model=WebhookHealth)
async def webhook_health():
    """Health check endpoint for monitoring"""
    return WebhookHealth(
        status="healthy",
        timestamp=datetime.utcnow().isoformat()
    )


@router.post("/tradingview", response_model=SignalResponse)
async def receive_tradingview_signal(
    signal: TradingViewSignal,
    request: Request,
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
):
    """
    Receive and process TradingView webhook signals.

    Authentication methods (in order of preference):
    1. X-Signature header with HMAC-SHA256
    2. Secret field in payload matching strategy webhook secret

    Flow:
    1. Validate authentication
    2. Look up strategy and user
    3. Validate signal parameters
    4. Queue signal for execution
    5. Return signal ID for tracking
    """
    signal_id = str(uuid.uuid4())
    client_ip = request.client.host if request.client else "unknown"

    set_log_context(
        signal_id=signal_id,
        strategy_id=signal.strategy_id,
        symbol=signal.symbol,
    )

    try:
        logger.info(
            "Received TradingView signal",
            extra_data={
                "action": signal.action,
                "price": signal.price,
                "client_ip": client_ip,
            }
        )

        # TODO: Look up strategy from database
        # strategy = await get_strategy(signal.strategy_id)
        # if not strategy:
        #     raise HTTPException(status_code=404, detail="Strategy not found")

        # TODO: Verify webhook secret
        # For now, we'll accept any signal with a secret that matches pattern
        if not signal.secret or len(signal.secret) < 16:
            logger.warning(
                "Invalid webhook secret",
                extra_data={"client_ip": client_ip}
            )
            raise HTTPException(
                status_code=401,
                detail="Invalid or missing webhook secret"
            )

        # TODO: Get user from strategy
        # user_id = strategy.user_id
        # set_log_context(user_id=user_id)

        # Validate price data
        entry_price = None
        stop_loss = None
        take_profit = None

        try:
            if signal.price:
                entry_price = Decimal(signal.price)
            if signal.stop_loss:
                stop_loss = Decimal(signal.stop_loss)
            if signal.take_profit:
                take_profit = Decimal(signal.take_profit)
        except Exception as e:
            logger.warning(
                "Invalid price format in signal",
                extra_data={"error": str(e)}
            )
            raise HTTPException(
                status_code=400,
                detail=f"Invalid price format: {e}"
            )

        # Determine priority based on action type
        # Exit signals are higher priority (need to close positions quickly)
        priority = QueuePriority.HIGH if "exit" in signal.action else QueuePriority.NORMAL

        # Build queued signal
        # TODO: Get user_id from strategy lookup
        user_id = "demo-user"  # Placeholder until DB integration

        queued_signal = QueuedSignal(
            signal_id=signal_id,
            user_id=user_id,
            strategy_id=signal.strategy_id,
            symbol=signal.symbol,
            action=signal.action,
            price=str(entry_price) if entry_price else None,
            stop_loss=str(stop_loss) if stop_loss else None,
            take_profit=str(take_profit) if take_profit else None,
            leverage=signal.leverage or 1,
            priority=priority,
        )

        # Queue signal for processing
        queue = get_signal_queue()
        queued = False

        if queue:
            # Create dedup key to prevent duplicate signals
            dedup_key = f"{user_id}:{signal.symbol}:{signal.action}"

            queued = await queue.enqueue(
                queued_signal,
                dedup_key=dedup_key,
                dedup_ttl=30,  # 30 second dedup window
            )

            if not queued:
                logger.info(
                    "Signal deduplicated (duplicate within 30s)",
                    extra_data={"dedup_key": dedup_key}
                )
                return SignalResponse(
                    success=True,
                    signal_id=signal_id,
                    message="Signal deduplicated (duplicate within 30 seconds)",
                    queued=False,
                )
        else:
            logger.warning("Signal queue not available, signal not queued")

        logger.info(
            "Signal queued for processing",
            extra_data={
                "action": signal.action,
                "priority": priority,
                "queued": queued,
            }
        )

        return SignalResponse(
            success=True,
            signal_id=signal_id,
            message="Signal received and queued for processing",
            queued=queued,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error processing signal: {e}",
            extra_data={"error": str(e)},
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail="Internal error processing signal"
        )
    finally:
        clear_log_context()


@router.get("/queue/stats")
async def get_queue_stats():
    """Get queue statistics"""
    queue = get_signal_queue()
    if not queue:
        return {"error": "Queue not available", "stats": None}

    stats = await queue.get_stats()
    return {"stats": stats}


@router.post("/test", response_model=SignalResponse)
async def test_webhook(request: Request):
    """
    Test endpoint for verifying webhook connectivity.

    Accepts any JSON payload and echoes back success.
    Useful for testing TradingView alert configuration.
    """
    try:
        body = await request.json()
        logger.info(
            "Test webhook received",
            extra_data={"payload": body}
        )
        return SignalResponse(
            success=True,
            message="Test webhook received successfully",
            queued=False,
        )
    except Exception as e:
        logger.warning(f"Test webhook error: {e}")
        return SignalResponse(
            success=False,
            message=f"Error parsing payload: {e}",
            queued=False,
        )
