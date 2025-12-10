"""
Trade Executor

Executes trades on exchanges based on validated signals.
Orchestrates risk checks, order placement, and position tracking.
"""
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

from app.logging.logger import get_logger, set_log_context, clear_log_context
from app.exchanges.base import (
    ExchangeAdapter,
    OrderRequest,
    OrderResult,
    OrderSide,
    OrderType,
    OrderStatus,
    ExchangeError,
    InsufficientFundsError,
)
from app.core.risk_manager import (
    RiskManager,
    RiskSettings,
    RiskCheckResult,
    TradeRequest,
    PortfolioState,
)

logger = get_logger("executor")


class ExecutionStatus(str, Enum):
    PENDING = "pending"
    RISK_CHECK_FAILED = "risk_check_failed"
    EXECUTING = "executing"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    FAILED = "failed"
    CANCELED = "canceled"


@dataclass
class Signal:
    """Trading signal to execute"""
    id: str
    user_id: str
    strategy_id: str
    symbol: str
    action: str  # 'long_entry', 'long_exit', 'short_entry', 'short_exit'
    price: Optional[Decimal] = None
    stop_loss: Optional[Decimal] = None
    take_profit: Optional[Decimal] = None
    quantity: Optional[Decimal] = None
    leverage: int = 1


@dataclass
class ExecutionResult:
    """Result of trade execution"""
    signal_id: str
    status: ExecutionStatus
    order_id: Optional[str] = None
    filled_quantity: Optional[Decimal] = None
    avg_price: Optional[Decimal] = None
    fee: Optional[Decimal] = None
    risk_check: Optional[RiskCheckResult] = None
    error: Optional[str] = None
    warnings: Optional[list] = None
    executed_at: Optional[datetime] = None


class TradeExecutor:
    """
    Orchestrates trade execution with risk management.

    Flow:
    1. Receive validated signal
    2. Get current portfolio state
    3. Run risk checks
    4. Build and submit order
    5. Track execution result
    6. Place stop loss / take profit orders
    """

    def __init__(
        self,
        exchange: ExchangeAdapter,
        risk_manager: RiskManager,
    ):
        self.exchange = exchange
        self.risk_manager = risk_manager

    async def execute_signal(
        self,
        signal: Signal,
        portfolio: PortfolioState,
    ) -> ExecutionResult:
        """
        Execute a trading signal with full risk management.

        Args:
            signal: The trading signal to execute
            portfolio: Current portfolio state for risk calculations

        Returns:
            ExecutionResult with order details or error
        """
        set_log_context(
            user_id=signal.user_id,
            signal_id=signal.id,
            strategy_id=signal.strategy_id,
            symbol=signal.symbol,
        )

        try:
            logger.info(
                f"Executing signal: {signal.action}",
                extra_data={
                    "action": signal.action,
                    "price": float(signal.price) if signal.price else None,
                    "leverage": signal.leverage,
                }
            )

            # Determine order side and direction
            is_entry = "entry" in signal.action
            is_long = "long" in signal.action

            if is_entry:
                return await self._execute_entry(signal, portfolio, is_long)
            else:
                return await self._execute_exit(signal, is_long)

        except Exception as e:
            logger.error(
                f"Execution failed: {e}",
                extra_data={"error": str(e)},
                exc_info=True,
            )
            return ExecutionResult(
                signal_id=signal.id,
                status=ExecutionStatus.FAILED,
                error=str(e),
            )
        finally:
            clear_log_context()

    async def _execute_entry(
        self,
        signal: Signal,
        portfolio: PortfolioState,
        is_long: bool,
    ) -> ExecutionResult:
        """Execute an entry trade (open position)"""

        # Get current price if not provided
        entry_price = signal.price
        if not entry_price:
            ticker = await self.exchange.get_ticker(signal.symbol)
            entry_price = ticker.last_price

        # Calculate position size if not provided
        quantity = signal.quantity
        if not quantity and signal.stop_loss:
            quantity = self.risk_manager.calculate_position_size(
                balance_usd=portfolio.total_balance_usd,
                entry_price=entry_price,
                stop_loss=signal.stop_loss,
            )

        if not quantity:
            # Default to risk-based calculation
            # Assume 2% risk with 2% stop distance
            stop_distance = entry_price * Decimal("0.02")
            hypothetical_stop = entry_price - stop_distance if is_long else entry_price + stop_distance
            quantity = self.risk_manager.calculate_position_size(
                balance_usd=portfolio.total_balance_usd,
                entry_price=entry_price,
                stop_loss=hypothetical_stop,
            )

        # Build trade request for risk check
        trade_request = TradeRequest(
            user_id=signal.user_id,
            symbol=signal.symbol,
            side="long" if is_long else "short",
            quantity=quantity,
            entry_price=entry_price,
            stop_loss=signal.stop_loss,
            take_profit=signal.take_profit,
            leverage=signal.leverage,
        )

        # Run risk checks
        risk_result = self.risk_manager.check_trade(trade_request, portfolio)

        if not risk_result.passed:
            logger.warning(
                f"Risk check failed: {risk_result.reason}",
                extra_data={"reason": risk_result.reason}
            )
            return ExecutionResult(
                signal_id=signal.id,
                status=ExecutionStatus.RISK_CHECK_FAILED,
                risk_check=risk_result,
                error=risk_result.reason,
            )

        # Use adjusted quantity if risk manager modified it
        if risk_result.adjusted_quantity:
            quantity = risk_result.adjusted_quantity
            logger.info(
                f"Using adjusted quantity: {quantity}",
                extra_data={"adjusted_quantity": float(quantity)}
            )

        # Build order
        order = OrderRequest(
            symbol=signal.symbol,
            side=OrderSide.BUY if is_long else OrderSide.SELL,
            type=OrderType.MARKET,
            quantity=quantity,
            leverage=signal.leverage,
        )

        # Execute order
        logger.info(
            f"Placing {order.side.value} order",
            extra_data={
                "quantity": float(quantity),
                "leverage": signal.leverage,
            }
        )

        try:
            order_result = await self.exchange.place_order(order)
        except InsufficientFundsError as e:
            logger.warning(f"Insufficient funds: {e}")
            return ExecutionResult(
                signal_id=signal.id,
                status=ExecutionStatus.FAILED,
                risk_check=risk_result,
                error=f"Insufficient funds: {e}",
            )
        except ExchangeError as e:
            logger.error(f"Exchange error: {e}")
            return ExecutionResult(
                signal_id=signal.id,
                status=ExecutionStatus.FAILED,
                risk_check=risk_result,
                error=str(e),
            )

        # Place stop loss if provided
        if signal.stop_loss and order_result.status == OrderStatus.FILLED:
            await self._place_stop_loss(
                signal=signal,
                quantity=order_result.filled_quantity,
                is_long=is_long,
            )

        # Place take profit if provided
        if signal.take_profit and order_result.status == OrderStatus.FILLED:
            await self._place_take_profit(
                signal=signal,
                quantity=order_result.filled_quantity,
                is_long=is_long,
            )

        # Map status
        status = self._map_order_status(order_result.status)

        logger.info(
            f"Entry executed: {status.value}",
            extra_data={
                "order_id": order_result.order_id,
                "filled": float(order_result.filled_quantity),
                "avg_price": float(order_result.avg_fill_price) if order_result.avg_fill_price else None,
            }
        )

        return ExecutionResult(
            signal_id=signal.id,
            status=status,
            order_id=order_result.order_id,
            filled_quantity=order_result.filled_quantity,
            avg_price=order_result.avg_fill_price,
            fee=order_result.fee,
            risk_check=risk_result,
            warnings=risk_result.warnings,
            executed_at=datetime.utcnow(),
        )

    async def _execute_exit(
        self,
        signal: Signal,
        is_long: bool,
    ) -> ExecutionResult:
        """Execute an exit trade (close position)"""

        # Get current positions
        positions = await self.exchange.get_positions(signal.symbol)

        if not positions:
            logger.warning(f"No position found for {signal.symbol}")
            return ExecutionResult(
                signal_id=signal.id,
                status=ExecutionStatus.FAILED,
                error=f"No open position for {signal.symbol}",
            )

        # Find matching position
        target_side = "long" if is_long else "short"
        position = None
        for pos in positions:
            if pos.side.value == target_side:
                position = pos
                break

        if not position:
            logger.warning(f"No {target_side} position found")
            return ExecutionResult(
                signal_id=signal.id,
                status=ExecutionStatus.FAILED,
                error=f"No {target_side} position for {signal.symbol}",
            )

        # Build close order
        quantity = signal.quantity or position.quantity
        order = OrderRequest(
            symbol=signal.symbol,
            side=OrderSide.SELL if is_long else OrderSide.BUY,
            type=OrderType.MARKET,
            quantity=quantity,
            reduce_only=True,
        )

        logger.info(
            f"Closing {target_side} position",
            extra_data={
                "quantity": float(quantity),
                "entry_price": float(position.entry_price),
            }
        )

        try:
            order_result = await self.exchange.place_order(order)
        except ExchangeError as e:
            logger.error(f"Exit order failed: {e}")
            return ExecutionResult(
                signal_id=signal.id,
                status=ExecutionStatus.FAILED,
                error=str(e),
            )

        status = self._map_order_status(order_result.status)

        # Calculate realized PnL
        realized_pnl = None
        if order_result.avg_fill_price and position.entry_price:
            price_diff = order_result.avg_fill_price - position.entry_price
            if not is_long:
                price_diff = -price_diff
            realized_pnl = price_diff * order_result.filled_quantity

        logger.info(
            f"Exit executed: {status.value}",
            extra_data={
                "order_id": order_result.order_id,
                "filled": float(order_result.filled_quantity),
                "realized_pnl": float(realized_pnl) if realized_pnl else None,
            }
        )

        return ExecutionResult(
            signal_id=signal.id,
            status=status,
            order_id=order_result.order_id,
            filled_quantity=order_result.filled_quantity,
            avg_price=order_result.avg_fill_price,
            fee=order_result.fee,
            executed_at=datetime.utcnow(),
        )

    async def _place_stop_loss(
        self,
        signal: Signal,
        quantity: Decimal,
        is_long: bool,
    ) -> Optional[OrderResult]:
        """Place stop loss order"""
        try:
            order = OrderRequest(
                symbol=signal.symbol,
                side=OrderSide.SELL if is_long else OrderSide.BUY,
                type=OrderType.STOP_MARKET,
                quantity=quantity,
                stop_price=signal.stop_loss,
                reduce_only=True,
            )

            result = await self.exchange.place_order(order)
            logger.info(
                "Stop loss placed",
                extra_data={
                    "order_id": result.order_id,
                    "stop_price": float(signal.stop_loss),
                }
            )
            return result
        except Exception as e:
            logger.warning(
                f"Failed to place stop loss: {e}",
                extra_data={"error": str(e)}
            )
            return None

    async def _place_take_profit(
        self,
        signal: Signal,
        quantity: Decimal,
        is_long: bool,
    ) -> Optional[OrderResult]:
        """Place take profit order"""
        try:
            order = OrderRequest(
                symbol=signal.symbol,
                side=OrderSide.SELL if is_long else OrderSide.BUY,
                type=OrderType.LIMIT,
                quantity=quantity,
                price=signal.take_profit,
                reduce_only=True,
            )

            result = await self.exchange.place_order(order)
            logger.info(
                "Take profit placed",
                extra_data={
                    "order_id": result.order_id,
                    "take_profit": float(signal.take_profit),
                }
            )
            return result
        except Exception as e:
            logger.warning(
                f"Failed to place take profit: {e}",
                extra_data={"error": str(e)}
            )
            return None

    def _map_order_status(self, status: OrderStatus) -> ExecutionStatus:
        """Map exchange order status to execution status"""
        mapping = {
            OrderStatus.PENDING: ExecutionStatus.PENDING,
            OrderStatus.OPEN: ExecutionStatus.EXECUTING,
            OrderStatus.FILLED: ExecutionStatus.FILLED,
            OrderStatus.PARTIALLY_FILLED: ExecutionStatus.PARTIALLY_FILLED,
            OrderStatus.CANCELED: ExecutionStatus.CANCELED,
            OrderStatus.FAILED: ExecutionStatus.FAILED,
        }
        return mapping.get(status, ExecutionStatus.FAILED)
