"""
Exchange Adapter Factory

Creates exchange adapters for trading operations.
Supports 14 CEX exchanges via CCXT integration.
"""
from typing import Optional, List, Dict, Any

from app.exchanges.base import ExchangeAdapter, ExchangeError
from app.exchanges.ccxt_adapter import (
    CCXTAdapter,
    create_ccxt_adapter,
    get_supported_ccxt_exchanges,
    get_exchange_config,
    EXCHANGE_CONFIG,
)
from app.logging.logger import get_logger

logger = get_logger("exchange.factory")


# Exchange metadata for UI display
EXCHANGE_METADATA: Dict[str, Dict[str, Any]] = {
    "binance": {
        "name": "Binance",
        "color": "#F0B90B",
        "logo": "binance.svg",
        "types": ["Spot", "Futures", "Margin"],
        "instruments": ["SmartTrade", "DCA", "GRID", "Signal"],
        "api_docs": "https://www.binance.com/en/my/settings/api-management",
        "countries": [],  # Global
    },
    "bingx": {
        "name": "BingX",
        "color": "#2354E6",
        "logo": "bingx.svg",
        "types": ["Spot", "Futures"],
        "instruments": ["SmartTrade", "DCA", "GRID", "Signal"],
        "api_docs": "https://bingx.com/en-us/account/api/",
        "countries": [],
    },
    "bitmex": {
        "name": "BitMEX",
        "color": "#F7931A",
        "logo": "bitmex.svg",
        "types": ["Futures"],
        "instruments": ["SmartTrade", "Signal"],
        "api_docs": "https://www.bitmex.com/app/apiKeys",
        "countries": [],
    },
    "blofin": {
        "name": "Blofin",
        "color": "#00D4AA",
        "logo": "blofin.svg",
        "types": ["Futures"],
        "instruments": ["SmartTrade", "DCA", "Signal"],
        "api_docs": "https://blofin.com/account/api",
        "countries": [],
        "requires_passphrase": True,
    },
    "bybit": {
        "name": "Bybit",
        "color": "#F7A600",
        "logo": "bybit.svg",
        "types": ["Spot", "Futures"],
        "instruments": ["SmartTrade", "DCA", "GRID", "Signal"],
        "api_docs": "https://www.bybit.com/app/user/api-management",
        "countries": [],
    },
    "coinbase": {
        "name": "Coinbase",
        "color": "#0052FF",
        "logo": "coinbase.svg",
        "types": ["Spot"],
        "instruments": ["SmartTrade", "DCA", "Signal"],
        "api_docs": "https://www.coinbase.com/settings/api",
        "countries": ["US", "CA", "GB", "DE", "FR"],
    },
    "coinbaseadvanced": {
        "name": "Coinbase Advanced",
        "color": "#0052FF",
        "logo": "coinbase.svg",
        "types": ["Spot"],
        "instruments": ["SmartTrade", "DCA", "Signal"],
        "api_docs": "https://www.coinbase.com/settings/api",
        "countries": ["US", "CA", "GB", "DE", "FR"],
    },
    "cryptocom": {
        "name": "Crypto.com",
        "color": "#002D74",
        "logo": "cryptocom.svg",
        "types": ["Spot", "Futures"],
        "instruments": ["SmartTrade", "DCA", "Signal"],
        "api_docs": "https://crypto.com/exchange/user/settings/api-management",
        "countries": [],
    },
    "deribit": {
        "name": "Deribit",
        "color": "#13B27A",
        "logo": "deribit.svg",
        "types": ["Futures", "Options"],
        "instruments": ["SmartTrade", "Signal"],
        "api_docs": "https://www.deribit.com/account#/tab-api",
        "countries": [],
    },
    "gateio": {
        "name": "Gate.io",
        "color": "#17E7AA",
        "logo": "gateio.svg",
        "types": ["Spot", "Futures"],
        "instruments": ["SmartTrade", "DCA", "GRID", "Signal"],
        "api_docs": "https://www.gate.io/myaccount/api_key_manage",
        "countries": [],
    },
    "kucoin": {
        "name": "KuCoin",
        "color": "#23AF91",
        "logo": "kucoin.svg",
        "types": ["Spot", "Futures"],
        "instruments": ["SmartTrade", "DCA", "GRID", "Signal"],
        "api_docs": "https://www.kucoin.com/account/api",
        "countries": [],
        "requires_passphrase": True,
    },
    "okx": {
        "name": "OKX",
        "color": "#000000",
        "logo": "okx.svg",
        "types": ["Spot", "Futures", "Margin"],
        "instruments": ["SmartTrade", "DCA", "GRID", "Signal"],
        "api_docs": "https://www.okx.com/account/my-api",
        "countries": [],
        "requires_passphrase": True,
    },
    "phemex": {
        "name": "Phemex",
        "color": "#0ECB81",
        "logo": "phemex.svg",
        "types": ["Spot", "Futures"],
        "instruments": ["SmartTrade", "DCA", "Signal"],
        "api_docs": "https://phemex.com/account/api-keys",
        "countries": [],
    },
    "woo": {
        "name": "WOO X",
        "color": "#0C1E32",
        "logo": "woo.svg",
        "types": ["Spot", "Futures"],
        "instruments": ["SmartTrade", "DCA", "Signal"],
        "api_docs": "https://x.woo.org/account/api",
        "countries": [],
    },
}


def get_exchange_adapter(
    exchange: str,
    api_key: str,
    api_secret: str,
    passphrase: Optional[str] = None,
    sandbox: bool = False,
) -> ExchangeAdapter:
    """
    Factory function to get an exchange adapter instance.

    Args:
        exchange: Exchange name (e.g., 'binance', 'bybit', 'okx')
        api_key: API key
        api_secret: API secret
        passphrase: Optional passphrase (required for some exchanges)
        sandbox: Whether to use sandbox/testnet mode

    Returns:
        ExchangeAdapter instance

    Raises:
        ExchangeError: If exchange is not supported
    """
    exchange_lower = exchange.lower()

    # Check if exchange is in our supported list
    if exchange_lower not in EXCHANGE_CONFIG:
        supported = ", ".join(get_supported_exchanges())
        raise ExchangeError(f"Unsupported exchange: {exchange}. Supported: {supported}")

    # Check if passphrase is required but not provided
    config = get_exchange_config(exchange_lower)
    if config.get("requires_passphrase") and not passphrase:
        raise ExchangeError(f"Exchange {exchange} requires a passphrase")

    # Create adapter using generic CCXT adapter
    adapter = create_ccxt_adapter(
        exchange_id=exchange_lower,
        api_key=api_key,
        api_secret=api_secret,
        passphrase=passphrase,
        sandbox=sandbox,
    )

    logger.info(
        f"Created exchange adapter",
        extra_data={"exchange": exchange_lower, "sandbox": sandbox}
    )

    return adapter


def get_supported_exchanges() -> List[str]:
    """Get list of supported exchange names"""
    return get_supported_ccxt_exchanges()


def is_exchange_supported(exchange: str) -> bool:
    """Check if an exchange is supported"""
    return exchange.lower() in EXCHANGE_CONFIG


def get_exchange_metadata(exchange: str) -> Dict[str, Any]:
    """Get metadata for an exchange (for UI display)"""
    return EXCHANGE_METADATA.get(exchange.lower(), {})


def get_all_exchange_metadata() -> Dict[str, Dict[str, Any]]:
    """Get metadata for all supported exchanges"""
    return EXCHANGE_METADATA


def requires_passphrase(exchange: str) -> bool:
    """Check if an exchange requires a passphrase"""
    config = get_exchange_config(exchange.lower())
    return config.get("requires_passphrase", False)
