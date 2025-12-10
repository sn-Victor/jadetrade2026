from typing import Optional

from app.exchanges.base import ExchangeAdapter, ExchangeError
from app.exchanges.binance import BinanceAdapter
from app.logging.logger import get_logger

logger = get_logger("exchange.factory")

# Registry of supported exchanges
EXCHANGE_ADAPTERS = {
    "binance": BinanceAdapter,
    # "bybit": BybitAdapter,  # TODO: Implement
    # "coinbase": CoinbaseAdapter,  # TODO: Implement
}


def get_exchange_adapter(
    exchange: str,
    api_key: str,
    api_secret: str,
    passphrase: Optional[str] = None,
) -> ExchangeAdapter:
    """
    Factory function to get an exchange adapter instance.

    Args:
        exchange: Exchange name (e.g., 'binance', 'bybit')
        api_key: API key
        api_secret: API secret
        passphrase: Optional passphrase (required for some exchanges)

    Returns:
        ExchangeAdapter instance

    Raises:
        ExchangeError: If exchange is not supported
    """
    exchange_lower = exchange.lower()

    if exchange_lower not in EXCHANGE_ADAPTERS:
        supported = ", ".join(EXCHANGE_ADAPTERS.keys())
        raise ExchangeError(f"Unsupported exchange: {exchange}. Supported: {supported}")

    adapter_class = EXCHANGE_ADAPTERS[exchange_lower]
    adapter = adapter_class(api_key, api_secret, passphrase)

    logger.info(f"Created exchange adapter", extra_data={"exchange": exchange_lower})

    return adapter


def get_supported_exchanges() -> list[str]:
    """Get list of supported exchange names"""
    return list(EXCHANGE_ADAPTERS.keys())


def is_exchange_supported(exchange: str) -> bool:
    """Check if an exchange is supported"""
    return exchange.lower() in EXCHANGE_ADAPTERS
