"""
Signal Processor Worker

Background worker that processes trading signals from the queue.
Handles the full pipeline: dequeue → validate → execute → complete/fail
"""
import asyncio
from typing import Optional, Dict, Any
from decimal import Decimal
from datetime import datetime

from app.logging.logger import get_logger, set_log_context, clear_log_context
from app.core.queue import SignalQueue, QueuedSignal, QueuePriority
from app.core.trade_executor import TradeExecutor, Signal, ExecutionResult, ExecutionStatus
from app.core.risk_manager import RiskManager, RiskSettings, PortfolioState
from app.exchanges.base import ExchangeAdapter

logger = get_logger("worker.signal")


class SignalProcessor:
    """
    Processes trading signals from the queue.

    Responsibilities:
    - Dequeue signals
    - Load user context (exchange, risk settings)
    - Execute trades via TradeExecutor
    - Handle success/failure
    - Update signal status
    """

    def __init__(
        self,
        queue: SignalQueue,
        get_user_exchange: callable,  # async fn(user_id, strategy_id) -> ExchangeAdapter
        get_user_risk_settings: callable,  # async fn(user_id) -> RiskSettings
        get_portfolio_state: callable,  # async fn(user_id, exchange) -> PortfolioState
    ):
        self.queue = queue
        self.get_user_exchange = get_user_exchange
        self.get_user_risk_settings = get_user_risk_settings
        self.get_portfolio_state = get_portfolio_state
        self._running = False
        self._task: Optional[asyncio.Task] = None

    async def start(self, num_workers: int = 1) -> None:
        """Start the signal processor workers"""
        self._running = True
        logger.info(f"Starting {num_workers} signal processor workers")

        # Start worker tasks
        tasks = [
            asyncio.create_task(self._worker_loop(worker_id=i))
            for i in range(num_workers)
        ]
        self._task = asyncio.gather(*tasks)

    async def stop(self) -> None:
        """Stop the signal processor"""
        logger.info("Stopping signal processor")
        self._running = False

        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _worker_loop(self, worker_id: int) -> None:
        """Main worker loop - continuously process signals"""
        logger.info(f"Worker {worker_id} started")

        while self._running:
            try:
                # Dequeue with timeout (allows graceful shutdown)
                signal = await self.queue.dequeue(timeout=5)

                if signal:
                    await self._process_signal(signal, worker_id)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(
                    f"Worker {worker_id} error: {e}",
                    extra_data={"error": str(e)},
                    exc_info=True,
                )
                await asyncio.sleep(1)  # Prevent tight error loop

        logger.info(f"Worker {worker_id} stopped")

    async def _process_signal(
        self,
        queued_signal: QueuedSignal,
        worker_id: int,
    ) -> None:
        """Process a single signal"""
        set_log_context(
            signal_id=queued_signal.signal_id,
            user_id=queued_signal.user_id,
            worker_id=worker_id,
        )

        start_time = datetime.utcnow()

        try:
            logger.info(
                f"Processing signal",
                extra_data={
                    "symbol": queued_signal.symbol,
                    "action": queued_signal.action,
                    "retry_count": queued_signal.retry_count,
                }
            )

            # Load user context
            exchange = await self.get_user_exchange(
                queued_signal.user_id,
                queued_signal.strategy_id,
            )

            if not exchange:
                raise ValueError("No exchange configured for user/strategy")

            risk_settings = await self.get_user_risk_settings(queued_signal.user_id)
            portfolio = await self.get_portfolio_state(queued_signal.user_id, exchange)

            # Build Signal for executor
            signal = Signal(
                id=queued_signal.signal_id,
                user_id=queued_signal.user_id,
                strategy_id=queued_signal.strategy_id,
                symbol=queued_signal.symbol,
                action=queued_signal.action,
                price=Decimal(queued_signal.price) if queued_signal.price else None,
                stop_loss=Decimal(queued_signal.stop_loss) if queued_signal.stop_loss else None,
                take_profit=Decimal(queued_signal.take_profit) if queued_signal.take_profit else None,
                leverage=queued_signal.leverage,
            )

            # Execute trade
            risk_manager = RiskManager(risk_settings)
            executor = TradeExecutor(exchange, risk_manager)

            result = await executor.execute_signal(signal, portfolio)

            # Handle result
            duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000

            if result.status in [ExecutionStatus.FILLED, ExecutionStatus.PARTIALLY_FILLED]:
                await self.queue.complete(queued_signal.signal_id)
                logger.info(
                    f"Signal executed successfully",
                    extra_data={
                        "status": result.status.value,
                        "order_id": result.order_id,
                        "filled_qty": float(result.filled_quantity) if result.filled_quantity else None,
                        "duration_ms": round(duration_ms, 2),
                    }
                )
            elif result.status == ExecutionStatus.RISK_CHECK_FAILED:
                # Don't retry risk check failures
                await self.queue.fail(
                    queued_signal.signal_id,
                    error=result.error or "Risk check failed",
                    retry=False,
                )
            else:
                # Retry other failures
                await self.queue.fail(
                    queued_signal.signal_id,
                    error=result.error or f"Execution failed: {result.status.value}",
                    retry=True,
                )

        except Exception as e:
            logger.error(
                f"Signal processing failed: {e}",
                extra_data={"error": str(e)},
                exc_info=True,
            )
            await self.queue.fail(
                queued_signal.signal_id,
                error=str(e),
                retry=True,
            )
        finally:
            clear_log_context()


async def create_mock_dependencies():
    """
    Create mock dependencies for testing.
    Used when database is not available.
    """
    async def get_user_exchange(user_id: str, strategy_id: str) -> Optional[ExchangeAdapter]:
        logger.debug(f"Mock: Getting exchange for user {user_id}")
        return None

    async def get_user_risk_settings(user_id: str) -> RiskSettings:
        logger.debug(f"Mock: Getting risk settings for user {user_id}")
        return RiskSettings()

    async def get_portfolio_state(user_id: str, exchange: ExchangeAdapter) -> PortfolioState:
        logger.debug(f"Mock: Getting portfolio state for user {user_id}")
        return PortfolioState(
            total_balance_usd=Decimal("10000"),
            open_positions_count=0,
            open_positions_value_usd=Decimal("0"),
            daily_trades_count=0,
            daily_pnl_percent=Decimal("0"),
            daily_loss_percent=Decimal("0"),
        )

    return get_user_exchange, get_user_risk_settings, get_portfolio_state


async def run_worker(
    redis_url: str = "redis://localhost:6379",
    use_real_db: bool = True,
):
    """
    Run the signal processor worker.

    Args:
        redis_url: Redis connection URL
        use_real_db: Whether to use real database dependencies (vs mock)

    Usage:
        python -m app.workers.signal_processor
    """
    import redis.asyncio as redis
    from app.config import settings

    logger.info("Starting signal processor worker...")
    logger.info(f"Redis URL: {redis_url}")
    logger.info(f"Use real DB: {use_real_db}")

    # Connect to Redis
    logger.info("Connecting to Redis...")
    redis_client = redis.from_url(redis_url, decode_responses=True)

    try:
        await redis_client.ping()
        logger.info("Redis connected")
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")
        return

    queue = SignalQueue(redis_client)

    # Get dependencies
    if use_real_db:
        from app.core.database import AsyncSessionLocal
        from app.core.signal_dependencies import create_signal_processor_dependencies

        # Create a persistent session for the worker
        # Note: In production, you might want to create sessions per-signal
        async with AsyncSessionLocal() as db:
            logger.info("Database session created")
            get_exchange, get_risk, get_portfolio = create_signal_processor_dependencies(db)

            processor = SignalProcessor(
                queue=queue,
                get_user_exchange=get_exchange,
                get_user_risk_settings=get_risk,
                get_portfolio_state=get_portfolio,
            )

            try:
                await processor.start(num_workers=2)
                logger.info("Signal processor started with 2 workers")

                # Keep running until interrupted
                while True:
                    stats = await queue.get_stats()
                    logger.info("Queue stats", extra_data=stats)
                    await asyncio.sleep(30)
            except KeyboardInterrupt:
                logger.info("Shutting down...")
            finally:
                await processor.stop()
    else:
        # Use mock dependencies
        get_exchange, get_risk, get_portfolio = await create_mock_dependencies()

        processor = SignalProcessor(
            queue=queue,
            get_user_exchange=get_exchange,
            get_user_risk_settings=get_risk,
            get_portfolio_state=get_portfolio,
        )

        try:
            await processor.start(num_workers=2)
            logger.info("Signal processor started with mock dependencies")

            while True:
                stats = await queue.get_stats()
                logger.info("Queue stats", extra_data=stats)
                await asyncio.sleep(30)
        except KeyboardInterrupt:
            logger.info("Shutting down...")
        finally:
            await processor.stop()

    await redis_client.close()
    logger.info("Worker shutdown complete")


if __name__ == "__main__":
    import os
    from app.config import settings

    redis_url = os.getenv("REDIS_URL", settings.REDIS_URL)
    use_real_db = os.getenv("USE_MOCK_DB", "false").lower() != "true"

    asyncio.run(run_worker(redis_url=redis_url, use_real_db=use_real_db))
