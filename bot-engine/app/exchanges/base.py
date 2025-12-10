from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from decimal import Decimal
from enum import Enum


class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP_MARKET = "stop_market"
    STOP_LIMIT = "stop_limit"


class OrderStatus(str, Enum):
    PENDING = "pending"
    OPEN = "open"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    CANCELED = "canceled"
    FAILED = "failed"


class PositionSide(str, Enum):
    LONG = "long"
    SHORT = "short"


@dataclass
class OrderRequest:
    symbol: str
    side: OrderSide
    type: OrderType
    quantity: Decimal
    price: Optional[Decimal] = None
    stop_price: Optional[Decimal] = None
    take_profit: Optional[Decimal] = None
    stop_loss: Optional[Decimal] = None
    leverage: int = 1
    reduce_only: bool = False


@dataclass
class OrderResult:
    order_id: str
    status: OrderStatus
    filled_quantity: Decimal
    avg_fill_price: Optional[Decimal]
    fee: Optional[Decimal]
    fee_currency: Optional[str]
    raw_response: Dict[str, Any]


@dataclass
class Position:
    symbol: str
    side: PositionSide
    quantity: Decimal
    entry_price: Decimal
    current_price: Optional[Decimal]
    unrealized_pnl: Optional[Decimal]
    leverage: int
    liquidation_price: Optional[Decimal]
    margin: Optional[Decimal]


@dataclass
class Balance:
    asset: str
    free: Decimal
    locked: Decimal
    total: Decimal


@dataclass
class Ticker:
    symbol: str
    last_price: Decimal
    bid: Optional[Decimal]
    ask: Optional[Decimal]
    volume_24h: Optional[Decimal]
    change_24h: Optional[Decimal]


class ExchangeError(Exception):
    """Base exception for exchange errors"""
    pass


class InsufficientFundsError(ExchangeError):
    """Raised when there are insufficient funds for a trade"""
    pass


class InvalidOrderError(ExchangeError):
    """Raised when an order is invalid"""
    pass


class RateLimitError(ExchangeError):
    """Raised when rate limit is exceeded"""
    pass


class AuthenticationError(ExchangeError):
    """Raised when authentication fails"""
    pass


class ExchangeAdapter(ABC):
    """Abstract base class for exchange adapters"""

    def __init__(self, api_key: str, api_secret: str, passphrase: Optional[str] = None):
        self.api_key = api_key
        self.api_secret = api_secret
        self.passphrase = passphrase
        self._client = None

    @property
    @abstractmethod
    def name(self) -> str:
        """Exchange name identifier"""
        pass

    @property
    @abstractmethod
    def supports_futures(self) -> bool:
        """Whether this exchange supports futures trading"""
        pass

    @abstractmethod
    async def connect(self) -> None:
        """Initialize connection to exchange"""
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        """Close connection to exchange"""
        pass

    @abstractmethod
    async def validate_credentials(self) -> bool:
        """Validate API credentials"""
        pass

    # Market Data
    @abstractmethod
    async def get_ticker(self, symbol: str) -> Ticker:
        """Get current ticker for symbol"""
        pass

    @abstractmethod
    async def get_balance(self, asset: Optional[str] = None) -> List[Balance]:
        """Get account balance(s)"""
        pass

    # Orders
    @abstractmethod
    async def place_order(self, order: OrderRequest) -> OrderResult:
        """Place a new order"""
        pass

    @abstractmethod
    async def cancel_order(self, order_id: str, symbol: str) -> bool:
        """Cancel an existing order"""
        pass

    @abstractmethod
    async def get_order(self, order_id: str, symbol: str) -> OrderResult:
        """Get order status"""
        pass

    @abstractmethod
    async def get_open_orders(self, symbol: Optional[str] = None) -> List[OrderResult]:
        """Get all open orders"""
        pass

    # Positions (for futures)
    @abstractmethod
    async def get_positions(self, symbol: Optional[str] = None) -> List[Position]:
        """Get open positions"""
        pass

    @abstractmethod
    async def set_leverage(self, symbol: str, leverage: int) -> bool:
        """Set leverage for a symbol"""
        pass

    # Helpers
    def normalize_symbol(self, symbol: str) -> str:
        """Normalize symbol to exchange format (override if needed)"""
        return symbol.upper().replace("/", "")

    def format_quantity(self, quantity: Decimal, symbol: str) -> Decimal:
        """Format quantity to exchange precision (override if needed)"""
        return quantity

    def format_price(self, price: Decimal, symbol: str) -> Decimal:
        """Format price to exchange precision (override if needed)"""
        return price
