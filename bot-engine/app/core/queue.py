"""
Redis Queue for Signal Processing

Provides reliable queue operations for trading signals with:
- Priority queuing (urgent signals first)
- Dead letter queue for failed signals
- Signal deduplication
- Retry logic with exponential backoff
"""
import json
import asyncio
from typing import Optional, Dict, Any, List, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import redis.asyncio as redis

from app.logging.logger import get_logger

logger = get_logger("queue")


class QueuePriority(int, Enum):
    HIGH = 0      # Exit signals, stop losses
    NORMAL = 1    # Regular entry signals
    LOW = 2       # Delayed/scheduled signals


class SignalStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


@dataclass
class QueuedSignal:
    """Signal in the queue"""
    signal_id: str
    user_id: str
    strategy_id: str
    symbol: str
    action: str
    price: Optional[str] = None
    stop_loss: Optional[str] = None
    take_profit: Optional[str] = None
    leverage: int = 1
    priority: int = QueuePriority.NORMAL
    retry_count: int = 0
    max_retries: int = 3
    created_at: Optional[str] = None
    scheduled_at: Optional[str] = None

    def to_json(self) -> str:
        return json.dumps(asdict(self))

    @classmethod
    def from_json(cls, data: str) -> "QueuedSignal":
        return cls(**json.loads(data))


class SignalQueue:
    """
    Redis-based signal queue with priority support.

    Uses Redis sorted sets for priority queuing where score = priority + timestamp.
    This ensures FIFO within each priority level.
    """

    QUEUE_KEY = "signals:queue"
    PROCESSING_KEY = "signals:processing"
    DEAD_LETTER_KEY = "signals:dead_letter"
    SIGNAL_DATA_PREFIX = "signal:"
    DEDUP_PREFIX = "dedup:"

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    async def enqueue(
        self,
        signal: QueuedSignal,
        dedup_key: Optional[str] = None,
        dedup_ttl: int = 60,
    ) -> bool:
        """
        Add a signal to the queue.

        Args:
            signal: The signal to queue
            dedup_key: Optional key for deduplication (e.g., "user:symbol:action")
            dedup_ttl: Deduplication window in seconds

        Returns:
            True if queued, False if deduplicated
        """
        # Check deduplication
        if dedup_key:
            dedup_full_key = f"{self.DEDUP_PREFIX}{dedup_key}"
            exists = await self.redis.exists(dedup_full_key)
            if exists:
                logger.info(
                    f"Signal deduplicated",
                    extra_data={"signal_id": signal.signal_id, "dedup_key": dedup_key}
                )
                return False
            # Set dedup key with TTL
            await self.redis.setex(dedup_full_key, dedup_ttl, signal.signal_id)

        # Set creation timestamp
        if not signal.created_at:
            signal.created_at = datetime.utcnow().isoformat()

        # Store signal data
        signal_key = f"{self.SIGNAL_DATA_PREFIX}{signal.signal_id}"
        await self.redis.set(signal_key, signal.to_json())

        # Add to priority queue
        # Score = priority * 1e12 + timestamp (ensures priority ordering with FIFO within priority)
        timestamp = datetime.utcnow().timestamp()
        score = signal.priority * 1e12 + timestamp

        await self.redis.zadd(self.QUEUE_KEY, {signal.signal_id: score})

        logger.info(
            f"Signal enqueued",
            extra_data={
                "signal_id": signal.signal_id,
                "priority": signal.priority,
                "symbol": signal.symbol,
                "action": signal.action,
            }
        )

        return True

    async def dequeue(self, timeout: int = 0) -> Optional[QueuedSignal]:
        """
        Get the next signal from the queue.

        Args:
            timeout: Block for up to this many seconds (0 = no blocking)

        Returns:
            QueuedSignal or None if queue is empty
        """
        # Get highest priority signal (lowest score)
        if timeout > 0:
            result = await self.redis.bzpopmin(self.QUEUE_KEY, timeout)
            if not result:
                return None
            _, signal_id, _ = result
        else:
            result = await self.redis.zpopmin(self.QUEUE_KEY, count=1)
            if not result:
                return None
            signal_id, _ = result[0]

        # Get signal data
        signal_key = f"{self.SIGNAL_DATA_PREFIX}{signal_id}"
        signal_data = await self.redis.get(signal_key)

        if not signal_data:
            logger.warning(f"Signal data not found", extra_data={"signal_id": signal_id})
            return None

        signal = QueuedSignal.from_json(signal_data)

        # Move to processing set
        await self.redis.sadd(self.PROCESSING_KEY, signal_id)

        logger.debug(
            f"Signal dequeued",
            extra_data={"signal_id": signal_id, "action": signal.action}
        )

        return signal

    async def complete(self, signal_id: str) -> None:
        """Mark a signal as completed and clean up"""
        await self.redis.srem(self.PROCESSING_KEY, signal_id)
        await self.redis.delete(f"{self.SIGNAL_DATA_PREFIX}{signal_id}")

        logger.info(f"Signal completed", extra_data={"signal_id": signal_id})

    async def fail(
        self,
        signal_id: str,
        error: str,
        retry: bool = True,
    ) -> bool:
        """
        Mark a signal as failed.

        Args:
            signal_id: The signal ID
            error: Error message
            retry: Whether to retry (if retries remaining)

        Returns:
            True if will be retried, False if moved to dead letter
        """
        await self.redis.srem(self.PROCESSING_KEY, signal_id)

        # Get signal data
        signal_key = f"{self.SIGNAL_DATA_PREFIX}{signal_id}"
        signal_data = await self.redis.get(signal_key)

        if not signal_data:
            logger.warning(f"Signal not found for failure", extra_data={"signal_id": signal_id})
            return False

        signal = QueuedSignal.from_json(signal_data)

        if retry and signal.retry_count < signal.max_retries:
            # Increment retry count and re-queue with delay
            signal.retry_count += 1
            delay = min(2 ** signal.retry_count, 60)  # Exponential backoff, max 60s

            # Update signal data
            await self.redis.set(signal_key, signal.to_json())

            # Re-queue with lower priority and delay
            scheduled_time = datetime.utcnow() + timedelta(seconds=delay)
            score = QueuePriority.LOW * 1e12 + scheduled_time.timestamp()
            await self.redis.zadd(self.QUEUE_KEY, {signal_id: score})

            logger.warning(
                f"Signal scheduled for retry",
                extra_data={
                    "signal_id": signal_id,
                    "retry_count": signal.retry_count,
                    "delay_seconds": delay,
                    "error": error,
                }
            )
            return True
        else:
            # Move to dead letter queue
            dead_letter_data = {
                "signal": signal.to_json(),
                "error": error,
                "failed_at": datetime.utcnow().isoformat(),
            }
            await self.redis.lpush(self.DEAD_LETTER_KEY, json.dumps(dead_letter_data))
            await self.redis.delete(signal_key)

            logger.error(
                f"Signal moved to dead letter queue",
                extra_data={
                    "signal_id": signal_id,
                    "error": error,
                    "retry_count": signal.retry_count,
                }
            )
            return False

    async def get_queue_length(self) -> int:
        """Get number of signals in queue"""
        return await self.redis.zcard(self.QUEUE_KEY)

    async def get_processing_count(self) -> int:
        """Get number of signals being processed"""
        return await self.redis.scard(self.PROCESSING_KEY)

    async def get_dead_letter_count(self) -> int:
        """Get number of signals in dead letter queue"""
        return await self.redis.llen(self.DEAD_LETTER_KEY)

    async def get_stats(self) -> Dict[str, int]:
        """Get queue statistics"""
        return {
            "queued": await self.get_queue_length(),
            "processing": await self.get_processing_count(),
            "dead_letter": await self.get_dead_letter_count(),
        }

    async def recover_processing(self, max_age_seconds: int = 300) -> int:
        """
        Recover signals stuck in processing state.

        Moves signals that have been processing too long back to the queue.
        Returns number of recovered signals.
        """
        processing_ids = await self.redis.smembers(self.PROCESSING_KEY)
        recovered = 0

        for signal_id in processing_ids:
            signal_key = f"{self.SIGNAL_DATA_PREFIX}{signal_id}"
            signal_data = await self.redis.get(signal_key)

            if not signal_data:
                # Signal data missing, remove from processing
                await self.redis.srem(self.PROCESSING_KEY, signal_id)
                continue

            signal = QueuedSignal.from_json(signal_data)

            # Check age (use created_at as proxy since we don't track processing start)
            if signal.created_at:
                created = datetime.fromisoformat(signal.created_at)
                age = (datetime.utcnow() - created).total_seconds()

                if age > max_age_seconds:
                    # Re-queue the signal
                    signal.retry_count += 1
                    await self.redis.set(signal_key, signal.to_json())

                    score = QueuePriority.HIGH * 1e12 + datetime.utcnow().timestamp()
                    await self.redis.zadd(self.QUEUE_KEY, {signal_id: score})
                    await self.redis.srem(self.PROCESSING_KEY, signal_id)

                    recovered += 1
                    logger.warning(
                        f"Recovered stuck signal",
                        extra_data={"signal_id": signal_id, "age_seconds": age}
                    )

        return recovered
