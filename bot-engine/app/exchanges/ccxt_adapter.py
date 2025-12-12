"""
Generic CCXT Exchange Adapter

This adapter works with any CCXT-supported exchange by dynamically
creating the appropriate ccxt client based on exchange name.
"""
from typing import Optional, List, Dict, Any
from decimal import Decimal
import ccxt.async_support as ccxt

from app.exchanges.base import (
    ExchangeAdapter,
    OrderRequest,
    OrderResult,
    OrderSide,
    OrderType,
    OrderStatus,
    Position,
    PositionSide,
    Balance,
    Ticker,
    ExchangeError,
    InsufficientFundsError,
    InvalidOrderError,
    RateLimitError,
    AuthenticationError,
)
from app.logging.logger import get_logger

logger = get_logger("exchange.ccxt")


# Exchange-specific configuration
EXCHANGE_CONFIG: Dict[str, Dict[str, Any]] = {
    "binance": {
        "supports_futures": True,
        "default_type": "future",
        "requires_passphrase": False,
    },
    "bingx": {
        "supports_futures": True,
        "default_type": "swap",
        "requires_passphrase": False,
    },
    "bitmex": {
        "supports_futures": True,
        "default_type": "swap",
        "requires_passphrase": False,
    },
    "blofin": {
        "supports_futures": True,
        "default_type": "swap",
        "requires_passphrase": True,
    },
    "bybit": {
        "supports_futures": True,
        "default_type": "linear",
        "requires_passphrase": False,
    },
    "coinbase": {
        "supports_futures": False,
        "default_type": "spot",
        "requires_passphrase": False,
    },
    "coinbaseadvanced": {
        "supports_futures": False,
        "default_type": "spot",
        "requires_passphrase": False,
    },
    "cryptocom": {
        "supports_futures": True,
        "default_type": "spot",
        "requires_passphrase": False,
    },
    "deribit": {
        "supports_futures": True,
        "default_type": "future",
        "requires_passphrase": False,
    },
    "gateio": {
        "supports_futures": True,
        "default_type": "swap",
        "requires_passphrase": False,
    },
    "kucoin": {
        "supports_futures": True,
        "default_type": "spot",
        "requires_passphrase": True,
    },
    "okx": {
        "supports_futures": True,
        "default_type": "swap",
        "requires_passphrase": True,
    },
    "phemex": {
        "supports_futures": True,
        "default_type": "swap",
        "requires_passphrase": False,
    },
    "woo": {
        "supports_futures": True,
        "default_type": "swap",
        "requires_passphrase": False,
    },
}


class CCXTAdapter(ExchangeAdapter):
    """
    Generic exchange adapter using CCXT.

    Works with any CCXT-supported exchange by creating the appropriate
    client dynamically based on exchange name.
    """

    def __init__(
        self,
        exchange_id: str,
        api_key: str,
        api_secret: str,
        passphrase: Optional[str] = None,
        sandbox: bool = False,
    ):
        super().__init__(api_key, api_secret, passphrase)
        self._exchange_id = exchange_id.lower()
        self._sandbox = sandbox
        self._config = EXCHANGE_CONFIG.get(self._exchange_id, {
            "supports_futures": False,
            "default_type": "spot",
            "requires_passphrase": False,
        })

    @property
    def name(self) -> str:
        return self._exchange_id

    @property
    def supports_futures(self) -> bool:
        return self._config.get("supports_futures", False)

    async def connect(self) -> None:
        """Initialize connection to exchange"""
        # Get the ccxt exchange class
        exchange_class = getattr(ccxt, self._exchange_id, None)
        if not exchange_class:
            raise ExchangeError(f"Exchange {self._exchange_id} not supported by CCXT")

        # Build config
        config = {
            "apiKey": self.api_key,
            "secret": self.api_secret,
            "enableRateLimit": True,
            "options": {
                "adjustForTimeDifference": True,
            },
        }

        # Add passphrase if required
        if self.passphrase:
            config["password"] = self.passphrase

        # Set default market type
        default_type = self._config.get("default_type", "spot")
        config["options"]["defaultType"] = default_type

        # Enable sandbox mode if requested
        if self._sandbox:
            config["sandbox"] = True

        self._client = exchange_class(config)

        logger.info(
            f"Connected to {self._exchange_id}",
            extra_data={"type": default_type, "sandbox": self._sandbox}
        )

    async def disconnect(self) -> None:
        """Close connection to exchange"""
        if self._client:
            await self._client.close()
            self._client = None
            logger.info(f"Disconnected from {self._exchange_id}")

    async def validate_credentials(self) -> bool:
        """Validate API credentials by fetching balance"""
        try:
            await self._client.fetch_balance()
            logger.info(f"{self._exchange_id} credentials validated")
            return True
        except ccxt.AuthenticationError as e:
            logger.warning(
                f"{self._exchange_id} credential validation failed",
                extra_data={"error": str(e)}
            )
            return False
        except Exception as e:
            logger.error(f"{self._exchange_id} validation error: {e}", exc_info=True)
            return False

    async def get_ticker(self, symbol: str) -> Ticker:
        """Get current ticker for symbol"""
        try:
            ticker = await self._client.fetch_ticker(symbol)
            return Ticker(
                symbol=symbol,
                last_price=Decimal(str(ticker["last"])) if ticker.get("last") else Decimal(0),
                bid=Decimal(str(ticker["bid"])) if ticker.get("bid") else None,
                ask=Decimal(str(ticker["ask"])) if ticker.get("ask") else None,
                volume_24h=Decimal(str(ticker["quoteVolume"])) if ticker.get("quoteVolume") else None,
                change_24h=Decimal(str(ticker["percentage"])) if ticker.get("percentage") else None,
            )
        except ccxt.BadSymbol as e:
            raise InvalidOrderError(f"Invalid symbol: {symbol}") from e
        except Exception as e:
            raise ExchangeError(f"Failed to get ticker: {e}") from e

    async def get_balance(self, asset: Optional[str] = None) -> List[Balance]:
        """Get account balance(s)"""
        try:
            balance_data = await self._client.fetch_balance()
            balances = []

            for currency, data in balance_data.get("total", {}).items():
                if data > 0 or (asset and currency == asset):
                    balances.append(Balance(
                        asset=currency,
                        free=Decimal(str(balance_data["free"].get(currency, 0))),
                        locked=Decimal(str(balance_data["used"].get(currency, 0))),
                        total=Decimal(str(data)),
                    ))

            if asset:
                balances = [b for b in balances if b.asset == asset]

            return balances
        except ccxt.AuthenticationError as e:
            raise AuthenticationError(f"Authentication failed: {e}") from e
        except Exception as e:
            raise ExchangeError(f"Failed to get balance: {e}") from e

    async def place_order(self, order: OrderRequest) -> OrderResult:
        """Place a new order"""
        try:
            symbol = self.normalize_symbol(order.symbol)

            # Build order params
            params = {}
            if order.reduce_only:
                params["reduceOnly"] = True

            # Set leverage if specified and supported
            if order.leverage > 1 and self.supports_futures:
                await self.set_leverage(symbol, order.leverage)

            # Map order type
            order_type = order.type.value
            if order.type == OrderType.STOP_MARKET:
                order_type = "stop_market"
                params["stopPrice"] = float(order.stop_price)

            # Place order
            logger.info(
                f"Placing {order.side.value} {order.type.value} order on {self._exchange_id}",
                extra_data={
                    "symbol": symbol,
                    "quantity": float(order.quantity),
                    "price": float(order.price) if order.price else None,
                }
            )

            result = await self._client.create_order(
                symbol=symbol,
                type=order_type,
                side=order.side.value,
                amount=float(order.quantity),
                price=float(order.price) if order.price else None,
                params=params,
            )

            order_result = self._parse_order_result(result)

            logger.info(
                f"Order placed successfully on {self._exchange_id}",
                extra_data={
                    "order_id": order_result.order_id,
                    "status": order_result.status.value,
                    "filled": float(order_result.filled_quantity),
                }
            )

            return order_result

        except ccxt.InsufficientFunds as e:
            logger.warning(f"Insufficient funds on {self._exchange_id}: {e}")
            raise InsufficientFundsError(str(e)) from e
        except ccxt.InvalidOrder as e:
            logger.warning(f"Invalid order on {self._exchange_id}: {e}")
            raise InvalidOrderError(str(e)) from e
        except ccxt.RateLimitExceeded as e:
            logger.warning(f"Rate limit exceeded on {self._exchange_id}: {e}")
            raise RateLimitError(str(e)) from e
        except ccxt.AuthenticationError as e:
            logger.error(f"Authentication error on {self._exchange_id}: {e}")
            raise AuthenticationError(str(e)) from e
        except Exception as e:
            logger.error(f"Order placement failed on {self._exchange_id}: {e}", exc_info=True)
            raise ExchangeError(f"Failed to place order: {e}") from e

    async def cancel_order(self, order_id: str, symbol: str) -> bool:
        """Cancel an existing order"""
        try:
            await self._client.cancel_order(order_id, symbol)
            logger.info(
                f"Order cancelled on {self._exchange_id}",
                extra_data={"order_id": order_id, "symbol": symbol}
            )
            return True
        except ccxt.OrderNotFound:
            logger.warning(
                f"Order not found for cancellation on {self._exchange_id}",
                extra_data={"order_id": order_id}
            )
            return False
        except Exception as e:
            logger.error(f"Failed to cancel order on {self._exchange_id}: {e}")
            raise ExchangeError(f"Failed to cancel order: {e}") from e

    async def get_order(self, order_id: str, symbol: str) -> OrderResult:
        """Get order status"""
        try:
            order = await self._client.fetch_order(order_id, symbol)
            return self._parse_order_result(order)
        except ccxt.OrderNotFound as e:
            raise InvalidOrderError(f"Order not found: {order_id}") from e
        except Exception as e:
            raise ExchangeError(f"Failed to get order: {e}") from e

    async def get_open_orders(self, symbol: Optional[str] = None) -> List[OrderResult]:
        """Get all open orders"""
        try:
            orders = await self._client.fetch_open_orders(symbol)
            return [self._parse_order_result(o) for o in orders]
        except Exception as e:
            raise ExchangeError(f"Failed to get open orders: {e}") from e

    async def get_positions(self, symbol: Optional[str] = None) -> List[Position]:
        """Get open positions"""
        if not self.supports_futures:
            return []

        try:
            positions = await self._client.fetch_positions([symbol] if symbol else None)
            result = []

            for pos in positions:
                contracts = float(pos.get("contracts", 0) or pos.get("contractSize", 0) or 0)
                if contracts > 0:
                    result.append(Position(
                        symbol=pos["symbol"],
                        side=PositionSide.LONG if pos.get("side") == "long" else PositionSide.SHORT,
                        quantity=Decimal(str(contracts)),
                        entry_price=Decimal(str(pos["entryPrice"])) if pos.get("entryPrice") else Decimal(0),
                        current_price=Decimal(str(pos["markPrice"])) if pos.get("markPrice") else None,
                        unrealized_pnl=Decimal(str(pos["unrealizedPnl"])) if pos.get("unrealizedPnl") else None,
                        leverage=int(pos.get("leverage", 1) or 1),
                        liquidation_price=Decimal(str(pos["liquidationPrice"])) if pos.get("liquidationPrice") else None,
                        margin=Decimal(str(pos["initialMargin"])) if pos.get("initialMargin") else None,
                    ))

            return result
        except Exception as e:
            logger.warning(f"Failed to get positions from {self._exchange_id}: {e}")
            return []

    async def set_leverage(self, symbol: str, leverage: int) -> bool:
        """Set leverage for a symbol"""
        if not self.supports_futures:
            return False

        try:
            await self._client.set_leverage(leverage, symbol)
            logger.info(
                f"Leverage set on {self._exchange_id}",
                extra_data={"symbol": symbol, "leverage": leverage}
            )
            return True
        except Exception as e:
            logger.warning(f"Failed to set leverage on {self._exchange_id}: {e}")
            return False

    def _parse_order_result(self, order: dict) -> OrderResult:
        """Parse ccxt order to OrderResult"""
        status_map = {
            "open": OrderStatus.OPEN,
            "closed": OrderStatus.FILLED,
            "canceled": OrderStatus.CANCELED,
            "expired": OrderStatus.CANCELED,
            "rejected": OrderStatus.FAILED,
        }

        return OrderResult(
            order_id=str(order["id"]),
            status=status_map.get(order.get("status", ""), OrderStatus.PENDING),
            filled_quantity=Decimal(str(order.get("filled", 0) or 0)),
            avg_fill_price=Decimal(str(order["average"])) if order.get("average") else None,
            fee=Decimal(str(order["fee"]["cost"])) if order.get("fee") and order["fee"].get("cost") else None,
            fee_currency=order["fee"]["currency"] if order.get("fee") and order["fee"].get("currency") else None,
            raw_response=order,
        )


def create_ccxt_adapter(
    exchange_id: str,
    api_key: str,
    api_secret: str,
    passphrase: Optional[str] = None,
    sandbox: bool = False,
) -> CCXTAdapter:
    """Factory function to create a CCXT adapter for any supported exchange"""
    return CCXTAdapter(
        exchange_id=exchange_id,
        api_key=api_key,
        api_secret=api_secret,
        passphrase=passphrase,
        sandbox=sandbox,
    )


def get_supported_ccxt_exchanges() -> List[str]:
    """Get list of exchanges we've configured"""
    return list(EXCHANGE_CONFIG.keys())


def get_exchange_config(exchange_id: str) -> Dict[str, Any]:
    """Get configuration for an exchange"""
    return EXCHANGE_CONFIG.get(exchange_id.lower(), {})
