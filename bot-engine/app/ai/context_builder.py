"""
Chat Context Builder

Builds user context for AI chat by gathering trading data,
positions, P&L, and subscription info.
"""
from typing import Dict, Any, Optional, List
from decimal import Decimal

from app.logging.logger import get_logger

logger = get_logger("context")


async def build_user_context(user_id: str) -> Dict[str, Any]:
    """
    Build complete user context for AI chat.

    Gathers:
    - Subscription tier and limits
    - Portfolio value and P&L
    - Open positions
    - Active strategies
    - Recent trades

    Args:
        user_id: User ID to build context for

    Returns:
        Dictionary with user's trading context
    """
    context = {
        "subscription_tier": "free",
        "portfolio_value": None,
        "total_pnl": None,
        "open_positions": [],
        "active_strategies": [],
        "chat_messages_used": 0,
        "chat_messages_limit": 0,
    }

    try:
        # Try to get user data from database
        from app.core.database import get_db

        async with get_db() as db:
            # Get user info
            user = await db.fetchrow(
                """
                SELECT
                    subscription_tier,
                    chat_messages_used,
                    CASE
                        WHEN subscription_tier = 'pro' THEN 100
                        WHEN subscription_tier = 'enterprise' THEN -1
                        ELSE 0
                    END as chat_messages_limit
                FROM users
                WHERE id = $1
                """,
                user_id,
            )

            if user:
                context["subscription_tier"] = user["subscription_tier"]
                context["chat_messages_used"] = user["chat_messages_used"]
                context["chat_messages_limit"] = user["chat_messages_limit"]

            # Get portfolio summary
            portfolio = await db.fetchrow(
                """
                SELECT
                    SUM(balance_usd) as total_value,
                    SUM(unrealized_pnl) as unrealized_pnl,
                    SUM(realized_pnl) as realized_pnl
                FROM exchange_accounts
                WHERE user_id = $1 AND is_active = true
                """,
                user_id,
            )

            if portfolio and portfolio["total_value"]:
                context["portfolio_value"] = float(portfolio["total_value"])
                total_pnl = (portfolio["unrealized_pnl"] or 0) + (portfolio["realized_pnl"] or 0)
                context["total_pnl"] = float(total_pnl)

            # Get open positions
            positions = await db.fetch(
                """
                SELECT
                    symbol,
                    side,
                    entry_price,
                    quantity,
                    unrealized_pnl,
                    leverage
                FROM positions
                WHERE user_id = $1 AND status = 'open'
                ORDER BY unrealized_pnl DESC
                LIMIT 10
                """,
                user_id,
            )

            context["open_positions"] = [
                {
                    "symbol": p["symbol"],
                    "side": p["side"],
                    "entry_price": float(p["entry_price"]) if p["entry_price"] else None,
                    "quantity": float(p["quantity"]) if p["quantity"] else None,
                    "unrealized_pnl": float(p["unrealized_pnl"]) if p["unrealized_pnl"] else 0,
                    "leverage": p["leverage"],
                }
                for p in positions
            ]

            # Get active strategies
            strategies = await db.fetch(
                """
                SELECT
                    s.name,
                    s.symbol,
                    s.is_active,
                    COUNT(t.id) as trade_count,
                    SUM(t.pnl) as total_pnl
                FROM strategies s
                LEFT JOIN trades t ON t.strategy_id = s.id AND t.created_at > NOW() - INTERVAL '30 days'
                WHERE s.user_id = $1 AND s.is_active = true
                GROUP BY s.id, s.name, s.symbol, s.is_active
                LIMIT 10
                """,
                user_id,
            )

            context["active_strategies"] = [
                {
                    "name": s["name"],
                    "symbol": s["symbol"],
                    "trade_count": s["trade_count"] or 0,
                    "pnl_30d": float(s["total_pnl"]) if s["total_pnl"] else 0,
                }
                for s in strategies
            ]

    except ImportError:
        logger.debug("Database module not available, using mock context")
        context = await build_mock_context(user_id)
    except Exception as e:
        logger.warning(f"Failed to build user context: {e}")
        context = await build_mock_context(user_id)

    return context


async def build_mock_context(user_id: str) -> Dict[str, Any]:
    """
    Build mock context for testing/demo.

    Args:
        user_id: User ID

    Returns:
        Mock user context
    """
    return {
        "subscription_tier": "pro",
        "portfolio_value": 10000.00,
        "total_pnl": 523.45,
        "open_positions": [
            {
                "symbol": "BTCUSDT",
                "side": "long",
                "entry_price": 42500.00,
                "quantity": 0.1,
                "unrealized_pnl": 250.00,
                "leverage": 5,
            },
            {
                "symbol": "ETHUSDT",
                "side": "short",
                "entry_price": 2350.00,
                "quantity": 1.5,
                "unrealized_pnl": -45.00,
                "leverage": 3,
            },
        ],
        "active_strategies": [
            {
                "name": "BTC Momentum",
                "symbol": "BTCUSDT",
                "trade_count": 15,
                "pnl_30d": 450.00,
            },
            {
                "name": "ETH Scalper",
                "symbol": "ETHUSDT",
                "trade_count": 42,
                "pnl_30d": 73.45,
            },
        ],
        "chat_messages_used": 25,
        "chat_messages_limit": 100,
    }


def format_context_summary(context: Dict[str, Any]) -> str:
    """
    Format context as a human-readable summary.

    Useful for debugging or displaying to users.

    Args:
        context: User context dictionary

    Returns:
        Formatted string summary
    """
    lines = []

    lines.append(f"Subscription: {context.get('subscription_tier', 'unknown').title()}")

    if context.get("portfolio_value") is not None:
        lines.append(f"Portfolio: ${context['portfolio_value']:,.2f}")

    if context.get("total_pnl") is not None:
        pnl = context["total_pnl"]
        pnl_str = f"+${pnl:,.2f}" if pnl >= 0 else f"-${abs(pnl):,.2f}"
        lines.append(f"Total P&L: {pnl_str}")

    positions = context.get("open_positions", [])
    if positions:
        lines.append(f"Open Positions: {len(positions)}")
        for pos in positions[:3]:
            side = "Long" if pos["side"] == "long" else "Short"
            pnl = pos.get("unrealized_pnl", 0)
            pnl_str = f"+${pnl:.2f}" if pnl >= 0 else f"-${abs(pnl):.2f}"
            lines.append(f"  - {pos['symbol']}: {side} ({pnl_str})")

    strategies = context.get("active_strategies", [])
    if strategies:
        lines.append(f"Active Strategies: {len(strategies)}")

    return "\n".join(lines)
