from dataclasses import dataclass
from decimal import Decimal
from typing import Optional, List
from datetime import datetime, timedelta

from app.logging.logger import get_logger

logger = get_logger("risk")


@dataclass
class RiskSettings:
    """User's risk management settings"""
    max_position_size_usd: Decimal = Decimal("1000")
    max_leverage: int = 10
    max_open_positions: int = 5
    max_daily_trades: int = 50
    max_daily_loss_percent: Decimal = Decimal("10")
    max_portfolio_exposure_percent: Decimal = Decimal("80")
    default_risk_per_trade_percent: Decimal = Decimal("2")
    require_stop_loss: bool = True


@dataclass
class RiskCheckResult:
    """Result of a risk check"""
    passed: bool
    reason: Optional[str] = None
    adjusted_quantity: Optional[Decimal] = None
    warnings: Optional[List[str]] = None


@dataclass
class TradeRequest:
    """Incoming trade request to validate"""
    user_id: str
    symbol: str
    side: str  # 'long' or 'short'
    quantity: Decimal
    entry_price: Decimal
    stop_loss: Optional[Decimal] = None
    take_profit: Optional[Decimal] = None
    leverage: int = 1


@dataclass
class PortfolioState:
    """Current state of user's portfolio"""
    total_balance_usd: Decimal
    open_positions_count: int
    open_positions_value_usd: Decimal
    daily_trades_count: int
    daily_pnl_percent: Decimal
    daily_loss_percent: Decimal


class RiskManager:
    """
    Risk management engine that validates trades against user settings.

    Checks:
    - Position size limits
    - Leverage limits
    - Open position count
    - Daily trade count
    - Daily loss limits
    - Portfolio exposure
    - Stop loss requirements
    """

    def __init__(self, settings: RiskSettings):
        self.settings = settings

    def check_trade(
        self,
        trade: TradeRequest,
        portfolio: PortfolioState,
    ) -> RiskCheckResult:
        """
        Run all risk checks on a trade request.

        Returns RiskCheckResult with passed=True if trade is allowed,
        or passed=False with reason if rejected.
        """
        warnings = []

        # Check 1: Daily loss limit
        if portfolio.daily_loss_percent >= self.settings.max_daily_loss_percent:
            logger.warning(
                "Trade rejected: daily loss limit reached",
                extra_data={
                    "user_id": trade.user_id,
                    "daily_loss": float(portfolio.daily_loss_percent),
                    "limit": float(self.settings.max_daily_loss_percent),
                }
            )
            return RiskCheckResult(
                passed=False,
                reason=f"Daily loss limit reached ({portfolio.daily_loss_percent}% >= {self.settings.max_daily_loss_percent}%)"
            )

        # Check 2: Daily trade count
        if portfolio.daily_trades_count >= self.settings.max_daily_trades:
            logger.warning(
                "Trade rejected: daily trade limit reached",
                extra_data={
                    "user_id": trade.user_id,
                    "trades_today": portfolio.daily_trades_count,
                    "limit": self.settings.max_daily_trades,
                }
            )
            return RiskCheckResult(
                passed=False,
                reason=f"Daily trade limit reached ({portfolio.daily_trades_count} >= {self.settings.max_daily_trades})"
            )

        # Check 3: Open positions count
        if portfolio.open_positions_count >= self.settings.max_open_positions:
            logger.warning(
                "Trade rejected: max open positions reached",
                extra_data={
                    "user_id": trade.user_id,
                    "open_positions": portfolio.open_positions_count,
                    "limit": self.settings.max_open_positions,
                }
            )
            return RiskCheckResult(
                passed=False,
                reason=f"Max open positions reached ({portfolio.open_positions_count} >= {self.settings.max_open_positions})"
            )

        # Check 4: Leverage limit
        if trade.leverage > self.settings.max_leverage:
            logger.warning(
                "Trade rejected: leverage too high",
                extra_data={
                    "user_id": trade.user_id,
                    "requested_leverage": trade.leverage,
                    "max_leverage": self.settings.max_leverage,
                }
            )
            return RiskCheckResult(
                passed=False,
                reason=f"Leverage {trade.leverage}x exceeds maximum {self.settings.max_leverage}x"
            )

        # Check 5: Position size
        position_value_usd = trade.quantity * trade.entry_price
        if position_value_usd > self.settings.max_position_size_usd:
            # Calculate adjusted quantity
            adjusted_qty = self.settings.max_position_size_usd / trade.entry_price
            warnings.append(
                f"Position size reduced from ${position_value_usd} to ${self.settings.max_position_size_usd}"
            )
            logger.info(
                "Position size adjusted",
                extra_data={
                    "user_id": trade.user_id,
                    "original_qty": float(trade.quantity),
                    "adjusted_qty": float(adjusted_qty),
                }
            )
            return RiskCheckResult(
                passed=True,
                adjusted_quantity=adjusted_qty,
                warnings=warnings,
            )

        # Check 6: Portfolio exposure
        new_exposure = portfolio.open_positions_value_usd + position_value_usd
        exposure_percent = (new_exposure / portfolio.total_balance_usd * 100) if portfolio.total_balance_usd > 0 else Decimal(100)

        if exposure_percent > self.settings.max_portfolio_exposure_percent:
            logger.warning(
                "Trade rejected: portfolio exposure too high",
                extra_data={
                    "user_id": trade.user_id,
                    "exposure_percent": float(exposure_percent),
                    "limit": float(self.settings.max_portfolio_exposure_percent),
                }
            )
            return RiskCheckResult(
                passed=False,
                reason=f"Portfolio exposure {exposure_percent:.1f}% exceeds maximum {self.settings.max_portfolio_exposure_percent}%"
            )

        # Check 7: Stop loss required
        if self.settings.require_stop_loss and trade.stop_loss is None:
            logger.warning(
                "Trade rejected: stop loss required",
                extra_data={"user_id": trade.user_id, "symbol": trade.symbol}
            )
            return RiskCheckResult(
                passed=False,
                reason="Stop loss is required but not provided"
            )

        # All checks passed
        logger.info(
            "Risk check passed",
            extra_data={
                "user_id": trade.user_id,
                "symbol": trade.symbol,
                "side": trade.side,
                "quantity": float(trade.quantity),
                "position_value_usd": float(position_value_usd),
            }
        )

        return RiskCheckResult(
            passed=True,
            warnings=warnings if warnings else None,
        )

    def calculate_position_size(
        self,
        balance_usd: Decimal,
        entry_price: Decimal,
        stop_loss: Decimal,
        risk_percent: Optional[Decimal] = None,
    ) -> Decimal:
        """
        Calculate position size based on risk percentage.

        Uses the formula:
        Position Size = (Balance * Risk%) / (Entry - StopLoss)
        """
        risk = risk_percent or self.settings.default_risk_per_trade_percent
        risk_amount = balance_usd * (risk / 100)

        # Calculate distance to stop loss
        stop_distance = abs(entry_price - stop_loss)
        if stop_distance == 0:
            return Decimal(0)

        position_size = risk_amount / stop_distance

        # Cap at max position size
        max_qty = self.settings.max_position_size_usd / entry_price
        position_size = min(position_size, max_qty)

        logger.debug(
            "Position size calculated",
            extra_data={
                "risk_percent": float(risk),
                "risk_amount": float(risk_amount),
                "position_size": float(position_size),
            }
        )

        return position_size

    def validate_stop_loss(
        self,
        side: str,
        entry_price: Decimal,
        stop_loss: Decimal,
        max_loss_percent: Decimal = Decimal("5"),
    ) -> RiskCheckResult:
        """Validate stop loss is reasonable"""
        if side == "long":
            loss_percent = ((entry_price - stop_loss) / entry_price) * 100
            if stop_loss >= entry_price:
                return RiskCheckResult(
                    passed=False,
                    reason="Stop loss must be below entry price for long positions"
                )
        else:  # short
            loss_percent = ((stop_loss - entry_price) / entry_price) * 100
            if stop_loss <= entry_price:
                return RiskCheckResult(
                    passed=False,
                    reason="Stop loss must be above entry price for short positions"
                )

        if loss_percent > max_loss_percent:
            return RiskCheckResult(
                passed=False,
                reason=f"Stop loss too far ({loss_percent:.1f}% > {max_loss_percent}% max)"
            )

        return RiskCheckResult(passed=True)
