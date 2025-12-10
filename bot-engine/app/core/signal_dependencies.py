"""
Signal Processor Dependencies

Provides real implementations for SignalProcessor dependencies:
- get_user_exchange: Retrieves user's exchange adapter with decrypted credentials
- get_user_risk_settings: Retrieves user's risk management settings
- get_portfolio_state: Calculates user's current portfolio state
"""
from typing import Optional
from decimal import Decimal
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.logging.logger import get_logger
from app.core.key_service import get_user_exchange_credentials, mark_key_used, mark_key_invalid
from app.core.risk_manager import RiskSettings, PortfolioState
from app.core.strategy_service import get_strategy_by_id
from app.exchanges.base import ExchangeAdapter
from app.exchanges.factory import get_exchange_adapter

logger = get_logger("signal_deps")


async def get_user_exchange(
    db: AsyncSession,
    user_id: str,
    strategy_id: str,
) -> Optional[ExchangeAdapter]:
    """
    Get an initialized exchange adapter for a user based on their subscription.

    Flow:
    1. Look up strategy to determine which exchange to use
    2. Get user's decrypted API credentials for that exchange
    3. Create and connect the exchange adapter

    Args:
        db: Database session
        user_id: User ID
        strategy_id: Strategy UUID

    Returns:
        Connected ExchangeAdapter or None if credentials not found
    """
    try:
        # Get strategy to determine exchange
        strategy = await get_strategy_by_id(db, strategy_id)
        if not strategy:
            logger.warning(f"Strategy not found: {strategy_id}")
            return None

        exchange_name = strategy.exchange

        # Get user's decrypted credentials for this exchange
        credentials = await get_user_exchange_credentials(db, user_id, exchange_name)
        if not credentials:
            logger.warning(
                f"No valid API key for user on exchange",
                extra_data={"user_id": user_id, "exchange": exchange_name}
            )
            return None

        # Create exchange adapter
        adapter = get_exchange_adapter(
            exchange=exchange_name,
            api_key=credentials.api_key,
            api_secret=credentials.api_secret,
            passphrase=credentials.passphrase,
        )

        if not adapter:
            logger.error(f"Failed to create adapter for exchange: {exchange_name}")
            return None

        # Connect to exchange
        try:
            await adapter.connect()

            # Validate credentials
            is_valid = await adapter.validate_credentials()
            if not is_valid:
                logger.warning(
                    "Exchange credentials validation failed",
                    extra_data={"user_id": user_id, "exchange": exchange_name}
                )
                # Mark key as invalid
                await mark_key_invalid(db, credentials.key_id)
                await adapter.disconnect()
                return None

            # Mark key as used
            await mark_key_used(db, credentials.key_id)

            logger.info(
                "Exchange adapter initialized successfully",
                extra_data={"user_id": user_id, "exchange": exchange_name}
            )
            return adapter

        except Exception as e:
            logger.error(
                f"Failed to connect to exchange: {e}",
                extra_data={"user_id": user_id, "exchange": exchange_name}
            )
            # Check if it's an auth error
            if "auth" in str(e).lower() or "invalid" in str(e).lower():
                await mark_key_invalid(db, credentials.key_id)
            return None

    except Exception as e:
        logger.error(f"Error getting user exchange: {e}", exc_info=True)
        return None


async def get_user_risk_settings(
    db: AsyncSession,
    user_id: str,
) -> RiskSettings:
    """
    Get user's risk management settings.

    Args:
        db: Database session
        user_id: User ID

    Returns:
        RiskSettings with user's configured limits, or defaults if not set
    """
    try:
        result = await db.execute(
            text("""
                SELECT max_position_size_usd, max_leverage, max_open_positions,
                       max_daily_trades, max_daily_loss_percent, max_portfolio_exposure_percent,
                       default_risk_per_trade_percent, require_stop_loss
                FROM user_risk_settings
                WHERE user_id = :user_id
            """),
            {"user_id": user_id}
        )

        row = result.fetchone()
        if not row:
            logger.debug(f"No risk settings found for user {user_id}, using defaults")
            return RiskSettings()

        return RiskSettings(
            max_position_size_usd=Decimal(str(row.max_position_size_usd)) if row.max_position_size_usd else Decimal("1000"),
            max_leverage=row.max_leverage or 10,
            max_open_positions=row.max_open_positions or 5,
            max_daily_trades=row.max_daily_trades or 50,
            max_daily_loss_percent=Decimal(str(row.max_daily_loss_percent)) if row.max_daily_loss_percent else Decimal("10"),
            max_portfolio_exposure_percent=Decimal(str(row.max_portfolio_exposure_percent)) if row.max_portfolio_exposure_percent else Decimal("80"),
            risk_per_trade_percent=Decimal(str(row.default_risk_per_trade_percent)) if row.default_risk_per_trade_percent else Decimal("2"),
            require_stop_loss=row.require_stop_loss if row.require_stop_loss is not None else True,
        )

    except Exception as e:
        logger.error(f"Error getting risk settings: {e}", exc_info=True)
        return RiskSettings()


async def get_portfolio_state(
    db: AsyncSession,
    user_id: str,
    exchange: ExchangeAdapter,
) -> PortfolioState:
    """
    Calculate user's current portfolio state for risk management.

    Combines:
    - Live exchange balance
    - Database position tracking
    - Today's trading stats

    Args:
        db: Database session
        user_id: User ID
        exchange: Connected exchange adapter

    Returns:
        PortfolioState with current values
    """
    try:
        # Get live balance from exchange
        total_balance = Decimal("0")
        try:
            balances = await exchange.get_balance("USDT")
            if balances:
                total_balance = balances[0].total
        except Exception as e:
            logger.warning(f"Failed to get exchange balance: {e}")

        # Get open positions count and value from database
        positions_result = await db.execute(
            text("""
                SELECT COUNT(*) as count, COALESCE(SUM(entry_price * quantity), 0) as total_value
                FROM real_positions
                WHERE user_id = :user_id AND status = 'open'
            """),
            {"user_id": user_id}
        )
        pos_row = positions_result.fetchone()
        open_positions_count = pos_row.count if pos_row else 0
        open_positions_value = Decimal(str(pos_row.total_value)) if pos_row and pos_row.total_value else Decimal("0")

        # Get today's trading stats
        stats_result = await db.execute(
            text("""
                SELECT
                    COUNT(*) as trade_count,
                    COALESCE(SUM(realized_pnl), 0) as total_pnl
                FROM real_trades
                WHERE user_id = :user_id
                AND created_at >= CURRENT_DATE
                AND status = 'filled'
            """),
            {"user_id": user_id}
        )
        stats_row = stats_result.fetchone()
        daily_trades = stats_row.trade_count if stats_row else 0
        daily_pnl = Decimal(str(stats_row.total_pnl)) if stats_row and stats_row.total_pnl else Decimal("0")

        # Calculate percentages
        daily_pnl_percent = Decimal("0")
        daily_loss_percent = Decimal("0")
        if total_balance > 0:
            daily_pnl_percent = (daily_pnl / total_balance) * 100
            if daily_pnl < 0:
                daily_loss_percent = abs(daily_pnl_percent)

        return PortfolioState(
            total_balance_usd=total_balance,
            open_positions_count=open_positions_count,
            open_positions_value_usd=open_positions_value,
            daily_trades_count=daily_trades,
            daily_pnl_percent=daily_pnl_percent,
            daily_loss_percent=daily_loss_percent,
        )

    except Exception as e:
        logger.error(f"Error getting portfolio state: {e}", exc_info=True)
        # Return safe defaults that won't block trading
        return PortfolioState(
            total_balance_usd=Decimal("10000"),
            open_positions_count=0,
            open_positions_value_usd=Decimal("0"),
            daily_trades_count=0,
            daily_pnl_percent=Decimal("0"),
            daily_loss_percent=Decimal("0"),
        )


def create_signal_processor_dependencies(db: AsyncSession):
    """
    Factory function to create dependency callables for SignalProcessor.

    Returns functions that can be passed to SignalProcessor constructor.

    Args:
        db: Database session

    Returns:
        Tuple of (get_user_exchange, get_user_risk_settings, get_portfolio_state) functions
    """
    async def _get_user_exchange(user_id: str, strategy_id: str) -> Optional[ExchangeAdapter]:
        return await get_user_exchange(db, user_id, strategy_id)

    async def _get_user_risk_settings(user_id: str) -> RiskSettings:
        return await get_user_risk_settings(db, user_id)

    async def _get_portfolio_state(user_id: str, exchange: ExchangeAdapter) -> PortfolioState:
        return await get_portfolio_state(db, user_id, exchange)

    return _get_user_exchange, _get_user_risk_settings, _get_portfolio_state
