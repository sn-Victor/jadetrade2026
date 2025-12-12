"""
Exchange API Routes

Provides endpoints for:
- Listing supported exchanges
- Validating exchange credentials
- Testing exchange connectivity
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.exchanges.factory import (
    get_exchange_adapter,
    get_supported_exchanges,
    get_exchange_metadata,
    get_all_exchange_metadata,
    requires_passphrase,
    EXCHANGE_METADATA,
)
from app.exchanges.base import ExchangeError, AuthenticationError
from app.logging.logger import get_logger

logger = get_logger("api.exchanges")

router = APIRouter(prefix="/exchanges", tags=["Exchanges"])


class ExchangeInfo(BaseModel):
    """Exchange information for frontend display"""
    id: str
    name: str
    color: str
    logo: str
    types: List[str]
    instruments: List[str]
    api_docs: str
    requires_passphrase: bool = False
    supported: bool = True


class ExchangeListResponse(BaseModel):
    """Response for listing exchanges"""
    exchanges: List[ExchangeInfo]
    total: int


class CredentialTestRequest(BaseModel):
    """Request to test exchange credentials"""
    exchange: str
    api_key: str
    api_secret: str
    passphrase: Optional[str] = None


class CredentialTestResponse(BaseModel):
    """Response from credential test"""
    valid: bool
    exchange: str
    message: str
    balances: Optional[dict] = None


@router.get("/", response_model=ExchangeListResponse)
async def list_exchanges():
    """
    List all supported exchanges with metadata.

    Returns exchange information for UI display including:
    - Name, color, logo
    - Supported trading types (Spot, Futures, etc.)
    - Available instruments (SmartTrade, DCA, GRID, Signal)
    - API documentation URL
    - Whether passphrase is required
    """
    exchanges = []

    for exchange_id in get_supported_exchanges():
        meta = EXCHANGE_METADATA.get(exchange_id, {})
        exchanges.append(ExchangeInfo(
            id=exchange_id,
            name=meta.get("name", exchange_id.title()),
            color=meta.get("color", "#888888"),
            logo=meta.get("logo", f"{exchange_id}.svg"),
            types=meta.get("types", ["Spot"]),
            instruments=meta.get("instruments", ["SmartTrade"]),
            api_docs=meta.get("api_docs", ""),
            requires_passphrase=meta.get("requires_passphrase", False),
            supported=True,
        ))

    logger.info(f"Listed {len(exchanges)} exchanges")

    return ExchangeListResponse(
        exchanges=exchanges,
        total=len(exchanges),
    )


@router.get("/{exchange_id}", response_model=ExchangeInfo)
async def get_exchange(exchange_id: str):
    """
    Get information about a specific exchange.

    Args:
        exchange_id: Exchange identifier (e.g., 'binance', 'bybit')

    Returns:
        Exchange metadata

    Raises:
        404: If exchange is not supported
    """
    if exchange_id.lower() not in get_supported_exchanges():
        raise HTTPException(
            status_code=404,
            detail=f"Exchange '{exchange_id}' is not supported. "
                   f"Supported exchanges: {', '.join(get_supported_exchanges())}"
        )

    meta = EXCHANGE_METADATA.get(exchange_id.lower(), {})

    return ExchangeInfo(
        id=exchange_id.lower(),
        name=meta.get("name", exchange_id.title()),
        color=meta.get("color", "#888888"),
        logo=meta.get("logo", f"{exchange_id}.svg"),
        types=meta.get("types", ["Spot"]),
        instruments=meta.get("instruments", ["SmartTrade"]),
        api_docs=meta.get("api_docs", ""),
        requires_passphrase=meta.get("requires_passphrase", False),
        supported=True,
    )


@router.post("/test-credentials", response_model=CredentialTestResponse)
async def test_credentials(request: CredentialTestRequest):
    """
    Test exchange API credentials.

    This endpoint validates that the provided API credentials work
    by attempting to connect to the exchange and fetch balance info.

    Args:
        request: Exchange credentials to test

    Returns:
        Whether credentials are valid, with optional balance info
    """
    exchange_id = request.exchange.lower()

    # Check exchange is supported
    if exchange_id not in get_supported_exchanges():
        return CredentialTestResponse(
            valid=False,
            exchange=exchange_id,
            message=f"Exchange '{request.exchange}' is not supported",
        )

    # Check passphrase requirement
    if requires_passphrase(exchange_id) and not request.passphrase:
        return CredentialTestResponse(
            valid=False,
            exchange=exchange_id,
            message=f"Exchange '{request.exchange}' requires a passphrase",
        )

    try:
        # Create adapter
        adapter = get_exchange_adapter(
            exchange=exchange_id,
            api_key=request.api_key,
            api_secret=request.api_secret,
            passphrase=request.passphrase,
        )

        # Connect and validate
        await adapter.connect()
        is_valid = await adapter.validate_credentials()

        if is_valid:
            # Get balance to confirm working
            balances = await adapter.get_balance()
            balance_dict = {
                b.asset: {"free": float(b.free), "total": float(b.total)}
                for b in balances[:10]  # Limit to top 10 assets
            }

            await adapter.disconnect()

            logger.info(
                f"Credentials validated for {exchange_id}",
                extra_data={"assets": len(balance_dict)}
            )

            return CredentialTestResponse(
                valid=True,
                exchange=exchange_id,
                message="API credentials are valid",
                balances=balance_dict,
            )
        else:
            await adapter.disconnect()
            return CredentialTestResponse(
                valid=False,
                exchange=exchange_id,
                message="Invalid API credentials",
            )

    except AuthenticationError as e:
        logger.warning(f"Auth failed for {exchange_id}: {e}")
        return CredentialTestResponse(
            valid=False,
            exchange=exchange_id,
            message=f"Authentication failed: {str(e)}",
        )
    except ExchangeError as e:
        logger.error(f"Exchange error for {exchange_id}: {e}")
        return CredentialTestResponse(
            valid=False,
            exchange=exchange_id,
            message=f"Exchange error: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Unexpected error testing {exchange_id}: {e}", exc_info=True)
        return CredentialTestResponse(
            valid=False,
            exchange=exchange_id,
            message=f"Error connecting to exchange: {str(e)}",
        )
