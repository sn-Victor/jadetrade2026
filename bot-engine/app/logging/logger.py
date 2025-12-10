import logging
import json
import sys
from datetime import datetime
from typing import Optional, Dict, Any
from contextvars import ContextVar
from functools import lru_cache
import threading
import atexit

from app.config import settings

# Context variables for request-scoped data
request_context: ContextVar[Dict[str, Any]] = ContextVar('request_context', default={})


class LokiHandler(logging.Handler):
    """Custom handler that pushes logs to Loki"""

    def __init__(self, url: str, labels: Dict[str, str]):
        super().__init__()
        self.url = url
        self.base_labels = labels
        self.batch: list = []
        self.batch_size = 100
        self.lock = threading.Lock()
        # Register cleanup on exit
        atexit.register(self._flush)

    def emit(self, record: logging.LogRecord):
        try:
            # Get context from ContextVar
            ctx = request_context.get()

            # Build labels
            labels = {
                **self.base_labels,
                "level": record.levelname.lower(),
                "component": getattr(record, 'component', 'general'),
            }

            # Add context labels
            if ctx.get('user_id'):
                labels['user_id'] = str(ctx['user_id'])
            if ctx.get('exchange'):
                labels['exchange'] = ctx['exchange']
            if ctx.get('strategy_id'):
                labels['strategy_id'] = str(ctx['strategy_id'])
            if ctx.get('trade_id'):
                labels['trade_id'] = str(ctx['trade_id'])

            # Build log entry
            log_entry = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "level": record.levelname.lower(),
                "message": record.getMessage(),
                "component": labels.get('component'),
                "logger": record.name,
            }

            # Add extra fields
            if hasattr(record, 'extra_data') and record.extra_data:
                log_entry.update(record.extra_data)

            # Add exception info
            if record.exc_info:
                log_entry['error_type'] = record.exc_info[0].__name__ if record.exc_info[0] else None
                log_entry['stack_trace'] = self.formatException(record.exc_info)
                labels['error_type'] = log_entry['error_type'] or 'Unknown'

            # Format for Loki
            with self.lock:
                self.batch.append({
                    "stream": labels,
                    "values": [[str(int(datetime.utcnow().timestamp() * 1e9)), json.dumps(log_entry)]]
                })

                if len(self.batch) >= self.batch_size:
                    self._flush()

        except Exception as e:
            # Fallback to stderr
            sys.stderr.write(f"Failed to send log to Loki: {e}\n")

    def _flush(self):
        with self.lock:
            if not self.batch:
                return
            batch_to_send = self.batch
            self.batch = []

        try:
            import requests
            requests.post(
                f"{self.url}/loki/api/v1/push",
                json={"streams": batch_to_send},
                timeout=5
            )
        except Exception as e:
            sys.stderr.write(f"Failed to flush logs to Loki: {e}\n")

    def close(self):
        self._flush()
        super().close()


class StructuredFormatter(logging.Formatter):
    """JSON formatter for structured logging"""

    def format(self, record: logging.LogRecord) -> str:
        ctx = request_context.get()

        log_dict = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname.lower(),
            "service": "bot",
            "component": getattr(record, 'component', 'general'),
            "message": record.getMessage(),
            "logger": record.name,
        }

        # Add context
        if ctx:
            log_dict.update({k: v for k, v in ctx.items() if v is not None})

        # Add extra data
        if hasattr(record, 'extra_data') and record.extra_data:
            log_dict.update(record.extra_data)

        # Add exception
        if record.exc_info:
            log_dict['error_type'] = record.exc_info[0].__name__ if record.exc_info[0] else None
            log_dict['stack_trace'] = self.formatException(record.exc_info)

        return json.dumps(log_dict)


class ComponentLogger:
    """Logger wrapper that adds component context"""

    def __init__(self, logger: logging.Logger, component: str):
        self.logger = logger
        self.component = component

    def _log(self, level: int, msg: str, extra_data: Optional[Dict] = None, **kwargs):
        extra = {
            'component': self.component,
            'extra_data': extra_data or {}
        }
        self.logger.log(level, msg, extra=extra, **kwargs)

    def debug(self, msg: str, **kwargs):
        self._log(logging.DEBUG, msg, **kwargs)

    def info(self, msg: str, **kwargs):
        self._log(logging.INFO, msg, **kwargs)

    def warning(self, msg: str, **kwargs):
        self._log(logging.WARNING, msg, **kwargs)

    def error(self, msg: str, exc_info: bool = False, **kwargs):
        self._log(logging.ERROR, msg, exc_info=exc_info, **kwargs)

    def critical(self, msg: str, exc_info: bool = True, **kwargs):
        self._log(logging.CRITICAL, msg, exc_info=exc_info, **kwargs)


@lru_cache()
def get_logger(component: str) -> ComponentLogger:
    """Get a logger for a specific component"""
    logger = logging.getLogger(f"bot.{component}")

    if not logger.handlers:
        logger.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)

        # Console handler (JSON format)
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(StructuredFormatter())
        logger.addHandler(console_handler)

        # Loki handler (if configured)
        if settings.LOKI_URL:
            loki_handler = LokiHandler(
                url=settings.LOKI_URL,
                labels={
                    "service": "bot",
                    "env": settings.ENVIRONMENT,
                }
            )
            logger.addHandler(loki_handler)

    return ComponentLogger(logger, component)


def set_log_context(**kwargs):
    """Set context for the current request"""
    ctx = request_context.get().copy()
    ctx.update(kwargs)
    request_context.set(ctx)


def clear_log_context():
    """Clear the request context"""
    request_context.set({})
