from typing import Optional, List
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

logger = get_logger("exchange.binance")


class BinanceAdapter(ExchangeAdapter):
    """Binance exchange adapter using ccxt"""

    @property
    def name(self) -> str:
        return "binance"

    @property
    def supports_futures(self) -> bool:
        return True

    async def connect(self) -> None:
        """Initialize connection to Binance"""
        self._client = ccxt.binance({
            "apiKey": self.api_key,
            "secret": self.api_secret,
            "enableRateLimit": True,
            "options": {
                "defaultType": "future",  # Use futures by default
                "adjustForTimeDifference": True,
            },
        })
        logger.info("Connected to Binance", extra_data={"type": "futures"})

    async def disconnect(self) -> None:
        """Close connection to Binance"""
        if self._client:
            await self._client.close()
            self._client = None
            logger.info("Disconnected from Binance")

    async def validate_credentials(self) -> bool:
        """Validate API credentials by fetching balance"""
        try:
            await self._client.fetch_balance()
            logger.info("Binance credentials validated")
            return True
        except ccxt.AuthenticationError as e:
            logger.warning("Binance credential validation failed", extra_data={"error": str(e)})
            return False
        except Exception as e:
            logger.error(f"Binance validation error: {e}", exc_info=True)
            return False

    async def get_ticker(self, symbol: str) -> Ticker:
        """Get current ticker for symbol"""
        try:
            ticker = await self._client.fetch_ticker(symbol)
            return Ticker(
                symbol=symbol,
                last_price=Decimal(str(ticker["last"])),
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

            # Set leverage if specified
            if order.leverage > 1:
                await self.set_leverage(symbol, order.leverage)

            # Map order type
            order_type = order.type.value
            if order.type == OrderType.STOP_MARKET:
                order_type = "stop_market"
                params["stopPrice"] = float(order.stop_price)

            # Place order
            logger.info(
                f"Placing {order.side.value} {order.type.value} order",
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
                f"Order placed successfully",
                extra_data={
                    "order_id": order_result.order_id,
                    "status": order_result.status.value,
                    "filled": float(order_result.filled_quantity),
                }
            )

            return order_result

        except ccxt.InsufficientFunds as e:
            logger.warning(f"Insufficient funds: {e}")
            raise InsufficientFundsError(str(e)) from e
        except ccxt.InvalidOrder as e:
            logger.warning(f"Invalid order: {e}")
            raise InvalidOrderError(str(e)) from e
        except ccxt.RateLimitExceeded as e:
            logger.warning(f"Rate limit exceeded: {e}")
            raise RateLimitError(str(e)) from e
        except ccxt.AuthenticationError as e:
            logger.error(f"Authentication error: {e}")
            raise AuthenticationError(str(e)) from e
        except Exception as e:
            logger.error(f"Order placement failed: {e}", exc_info=True)
            raise ExchangeError(f"Failed to place order: {e}") from e

    async def cancel_order(self, order_id: str, symbol: str) -> bool:
        """Cancel an existing order"""
        try:
            await self._client.cancel_order(order_id, symbol)
            logger.info(f"Order cancelled", extra_data={"order_id": order_id, "symbol": symbol})
            return True
        except ccxt.OrderNotFound:
            logger.warning(f"Order not found for cancellation", extra_data={"order_id": order_id})
            return False
        except Exception as e:
            logger.error(f"Failed to cancel order: {e}")
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
        try:
            positions = await self._client.fetch_positions([symbol] if symbol else None)
            result = []

            for pos in positions:
                if float(pos.get("contracts", 0)) > 0:
                    result.append(Position(
                        symbol=pos["symbol"],
                        side=PositionSide.LONG if pos["side"] == "long" else PositionSide.SHORT,
                        quantity=Decimal(str(pos["contracts"])),
                        entry_price=Decimal(str(pos["entryPrice"])) if pos.get("entryPrice") else Decimal(0),
                        current_price=Decimal(str(pos["markPrice"])) if pos.get("markPrice") else None,
                        unrealized_pnl=Decimal(str(pos["unrealizedPnl"])) if pos.get("unrealizedPnl") else None,
                        leverage=int(pos.get("leverage", 1)),
                        liquidation_price=Decimal(str(pos["liquidationPrice"])) if pos.get("liquidationPrice") else None,
                        margin=Decimal(str(pos["initialMargin"])) if pos.get("initialMargin") else None,
                    ))

            return result
        except Exception as e:
            raise ExchangeError(f"Failed to get positions: {e}") from e

    async def set_leverage(self, symbol: str, leverage: int) -> bool:
        """Set leverage for a symbol"""
        try:
            await self._client.set_leverage(leverage, symbol)
            logger.info(f"Leverage set", extra_data={"symbol": symbol, "leverage": leverage})
            return True
        except Exception as e:
            logger.warning(f"Failed to set leverage: {e}")
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
            status=status_map.get(order["status"], OrderStatus.PENDING),
            filled_quantity=Decimal(str(order.get("filled", 0))),
            avg_fill_price=Decimal(str(order["average"])) if order.get("average") else None,
            fee=Decimal(str(order["fee"]["cost"])) if order.get("fee") else None,
            fee_currency=order["fee"]["currency"] if order.get("fee") else None,
            raw_response=order,
        )
