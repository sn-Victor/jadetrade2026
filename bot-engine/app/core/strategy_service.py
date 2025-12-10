"""
Strategy Service

Handles strategy lookups, subscription management, and webhook validation.
"""
from typing import Optional, List
from dataclasses import dataclass
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.logging.logger import get_logger

logger = get_logger("strategy_service")


@dataclass
class Strategy:
    """Strategy data"""
    id: str
    name: str
    description: Optional[str]
    webhook_token: str
    symbols: List[str]
    exchange: str
    is_active: bool
    min_tier: str
    risk_level: str
    timeframe: str


@dataclass
class StrategySubscription:
    """User's subscription to a strategy"""
    id: str
    user_id: str
    strategy_id: str
    auto_trade: bool
    risk_percent: float
    exchange_key_id: Optional[str]  # Which API key to use
    is_active: bool


async def get_strategy_by_id(
    db: AsyncSession,
    strategy_id: str,
) -> Optional[Strategy]:
    """
    Get a strategy by ID.

    Args:
        db: Database session
        strategy_id: Strategy UUID

    Returns:
        Strategy if found and active, None otherwise
    """
    result = await db.execute(
        text("""
            SELECT id, name, description, webhook_token, symbols,
                   COALESCE(supported_exchanges[1], 'binance') as exchange,
                   is_active, min_tier, risk_level, timeframe
            FROM strategies
            WHERE id = :strategy_id
        """),
        {"strategy_id": strategy_id}
    )

    row = result.fetchone()
    if not row:
        return None

    # Parse symbols (stored as comma-separated or array)
    symbols = []
    if row.symbols:
        if isinstance(row.symbols, list):
            symbols = row.symbols
        elif isinstance(row.symbols, str):
            symbols = [s.strip() for s in row.symbols.split(",")]

    return Strategy(
        id=str(row.id),
        name=row.name,
        description=row.description,
        webhook_token=row.webhook_token,
        symbols=symbols,
        exchange=row.exchange,
        is_active=row.is_active,
        min_tier=row.min_tier or "free",
        risk_level=row.risk_level or "medium",
        timeframe=row.timeframe or "1h",
    )


async def get_strategy_by_webhook_token(
    db: AsyncSession,
    webhook_token: str,
) -> Optional[Strategy]:
    """
    Get a strategy by webhook token (for TradingView authentication).

    Args:
        db: Database session
        webhook_token: The secret token from the webhook

    Returns:
        Strategy if found and active, None otherwise
    """
    result = await db.execute(
        text("""
            SELECT id, name, description, webhook_token, symbols,
                   COALESCE(supported_exchanges[1], 'binance') as exchange,
                   is_active, min_tier, risk_level, timeframe
            FROM strategies
            WHERE webhook_token = :webhook_token AND is_active = true
        """),
        {"webhook_token": webhook_token}
    )

    row = result.fetchone()
    if not row:
        return None

    symbols = []
    if row.symbols:
        if isinstance(row.symbols, list):
            symbols = row.symbols
        elif isinstance(row.symbols, str):
            symbols = [s.strip() for s in row.symbols.split(",")]

    return Strategy(
        id=str(row.id),
        name=row.name,
        description=row.description,
        webhook_token=row.webhook_token,
        symbols=symbols,
        exchange=row.exchange,
        is_active=row.is_active,
        min_tier=row.min_tier or "free",
        risk_level=row.risk_level or "medium",
        timeframe=row.timeframe or "1h",
    )


async def verify_webhook_secret(
    db: AsyncSession,
    strategy_id: str,
    secret: str,
) -> bool:
    """
    Verify that a webhook secret matches the strategy's token.

    Args:
        db: Database session
        strategy_id: Strategy UUID
        secret: Secret from webhook payload

    Returns:
        True if secret matches, False otherwise
    """
    result = await db.execute(
        text("""
            SELECT webhook_token
            FROM strategies
            WHERE id = :strategy_id AND is_active = true
        """),
        {"strategy_id": strategy_id}
    )

    row = result.fetchone()
    if not row:
        return False

    # Constant-time comparison to prevent timing attacks
    import hmac
    return hmac.compare_digest(row.webhook_token, secret)


async def get_subscribed_users(
    db: AsyncSession,
    strategy_id: str,
    auto_trade_only: bool = True,
) -> List[StrategySubscription]:
    """
    Get all users subscribed to a strategy.

    Args:
        db: Database session
        strategy_id: Strategy UUID
        auto_trade_only: Only return subscriptions with auto_trade enabled

    Returns:
        List of subscriptions
    """
    query = """
        SELECT ss.id, ss.user_id, ss.strategy_id, ss.auto_trade,
               ss.risk_percent, ss.exchange_key_id, ss.is_active
        FROM strategy_subscriptions ss
        WHERE ss.strategy_id = :strategy_id AND ss.is_active = true
    """

    if auto_trade_only:
        query += " AND ss.auto_trade = true"

    result = await db.execute(text(query), {"strategy_id": strategy_id})

    subscriptions = []
    for row in result.fetchall():
        subscriptions.append(StrategySubscription(
            id=str(row.id),
            user_id=row.user_id,
            strategy_id=str(row.strategy_id),
            auto_trade=row.auto_trade,
            risk_percent=float(row.risk_percent) if row.risk_percent else 1.0,
            exchange_key_id=str(row.exchange_key_id) if row.exchange_key_id else None,
            is_active=row.is_active,
        ))

    return subscriptions


async def get_user_subscription(
    db: AsyncSession,
    user_id: str,
    strategy_id: str,
) -> Optional[StrategySubscription]:
    """
    Get a user's subscription to a specific strategy.

    Args:
        db: Database session
        user_id: User ID
        strategy_id: Strategy UUID

    Returns:
        Subscription if found and active, None otherwise
    """
    result = await db.execute(
        text("""
            SELECT id, user_id, strategy_id, auto_trade,
                   risk_percent, exchange_key_id, is_active
            FROM strategy_subscriptions
            WHERE user_id = :user_id AND strategy_id = :strategy_id AND is_active = true
        """),
        {"user_id": user_id, "strategy_id": strategy_id}
    )

    row = result.fetchone()
    if not row:
        return None

    return StrategySubscription(
        id=str(row.id),
        user_id=row.user_id,
        strategy_id=str(row.strategy_id),
        auto_trade=row.auto_trade,
        risk_percent=float(row.risk_percent) if row.risk_percent else 1.0,
        exchange_key_id=str(row.exchange_key_id) if row.exchange_key_id else None,
        is_active=row.is_active,
    )


async def record_signal(
    db: AsyncSession,
    strategy_id: str,
    user_id: Optional[str],
    signal_type: str,
    symbol: str,
    exchange: str,
    price: Optional[str],
    stop_loss: Optional[str],
    take_profit: Optional[str],
    source: str = "tradingview",
    raw_payload: Optional[dict] = None,
) -> str:
    """
    Record a trading signal in the database.

    Args:
        db: Database session
        strategy_id: Strategy UUID
        user_id: User ID (if signal is for a specific user)
        signal_type: Type of signal (long_entry, long_exit, etc.)
        symbol: Trading pair
        exchange: Exchange name
        price: Signal price
        stop_loss: Suggested stop loss
        take_profit: Suggested take profit
        source: Signal source
        raw_payload: Original webhook payload

    Returns:
        Signal ID
    """
    import json

    result = await db.execute(
        text("""
            INSERT INTO trading_signals
            (strategy_id, user_id, signal_type, symbol, exchange, price,
             suggested_stop_loss, suggested_take_profit, source, raw_payload, status)
            VALUES (:strategy_id, :user_id, :signal_type, :symbol, :exchange, :price,
                    :stop_loss, :take_profit, :source, :raw_payload, 'received')
            RETURNING id
        """),
        {
            "strategy_id": strategy_id,
            "user_id": user_id,
            "signal_type": signal_type,
            "symbol": symbol,
            "exchange": exchange,
            "price": price,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "source": source,
            "raw_payload": json.dumps(raw_payload) if raw_payload else None,
        }
    )

    row = result.fetchone()
    await db.commit()

    return str(row.id)


async def update_signal_status(
    db: AsyncSession,
    signal_id: str,
    status: str,
    execution_result: Optional[dict] = None,
) -> None:
    """
    Update a signal's processing status.

    Args:
        db: Database session
        signal_id: Signal UUID
        status: New status
        execution_result: Execution result data
    """
    import json

    await db.execute(
        text("""
            UPDATE trading_signals
            SET status = :status,
                processed_at = NOW(),
                execution_result = :execution_result
            WHERE id = :signal_id
        """),
        {
            "signal_id": signal_id,
            "status": status,
            "execution_result": json.dumps(execution_result) if execution_result else None,
        }
    )
    await db.commit()
