"""
Exchange API Key Service

Handles decryption and retrieval of user exchange API keys from the database.
Uses AES-256-GCM encryption matching the Node.js backend.
"""
import hashlib
from typing import Optional, Dict, Any
from dataclasses import dataclass
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.logging.logger import get_logger

logger = get_logger("key_service")


@dataclass
class ExchangeCredentials:
    """Decrypted exchange credentials"""
    api_key: str
    api_secret: str
    passphrase: Optional[str] = None
    exchange: str = ""
    key_id: str = ""


def _derive_key(encryption_key: str, salt: str = "jadetrade-salt") -> bytes:
    """
    Derive a 32-byte key using scrypt (matching Node.js crypto.scryptSync).
    """
    # Use hashlib.scrypt for compatibility with Node.js crypto.scryptSync
    return hashlib.scrypt(
        password=encryption_key.encode(),
        salt=salt.encode(),
        n=16384,  # Node.js default
        r=8,
        p=1,
        dklen=32
    )


def decrypt_value(encrypted_text: str, encryption_key: str) -> str:
    """
    Decrypt a value encrypted with AES-256-GCM.
    
    Format: iv_hex:auth_tag_hex:encrypted_data_hex
    """
    parts = encrypted_text.split(":")
    if len(parts) != 3:
        raise ValueError("Invalid encrypted format")
    
    iv_hex, auth_tag_hex, encrypted_hex = parts
    
    iv = bytes.fromhex(iv_hex)
    auth_tag = bytes.fromhex(auth_tag_hex)
    encrypted = bytes.fromhex(encrypted_hex)
    
    # Derive key using scrypt
    key = _derive_key(encryption_key)
    
    # AES-GCM expects ciphertext + auth_tag concatenated
    ciphertext_with_tag = encrypted + auth_tag
    
    # Decrypt
    aesgcm = AESGCM(key)
    decrypted = aesgcm.decrypt(iv, ciphertext_with_tag, None)
    
    return decrypted.decode("utf-8")


async def get_user_exchange_credentials(
    db: AsyncSession,
    user_id: str,
    exchange: str,
) -> Optional[ExchangeCredentials]:
    """
    Get decrypted exchange credentials for a user.
    
    Args:
        db: Database session
        user_id: User's internal ID
        exchange: Exchange name (binance, bybit, etc.)
    
    Returns:
        ExchangeCredentials if found and valid, None otherwise
    """
    encryption_key = settings.ENCRYPTION_KEY
    if not encryption_key:
        logger.error("ENCRYPTION_KEY not configured")
        return None
    
    result = await db.execute(
        text("""
            SELECT id, api_key_encrypted, api_secret_encrypted, passphrase_encrypted,
                   is_active, can_trade, is_valid
            FROM exchange_api_keys
            WHERE user_id = :user_id AND exchange = :exchange AND is_active = true
            ORDER BY created_at DESC
            LIMIT 1
        """),
        {"user_id": user_id, "exchange": exchange.lower()}
    )
    
    row = result.fetchone()
    if not row:
        logger.warning(f"No API key found for user {user_id} on {exchange}")
        return None
    
    if not row.is_valid:
        logger.warning(f"API key for user {user_id} on {exchange} is marked invalid")
        return None
    
    if not row.can_trade:
        logger.warning(f"API key for user {user_id} on {exchange} does not have trade permission")
        return None
    
    try:
        api_key = decrypt_value(row.api_key_encrypted, encryption_key)
        api_secret = decrypt_value(row.api_secret_encrypted, encryption_key)
        passphrase = None
        if row.passphrase_encrypted:
            passphrase = decrypt_value(row.passphrase_encrypted, encryption_key)
        
        return ExchangeCredentials(
            api_key=api_key,
            api_secret=api_secret,
            passphrase=passphrase,
            exchange=exchange.lower(),
            key_id=str(row.id),
        )
    except Exception as e:
        logger.error(f"Failed to decrypt API key: {e}")
        return None


async def mark_key_used(db: AsyncSession, key_id: str) -> None:
    """Mark an API key as recently used."""
    await db.execute(
        text("UPDATE exchange_api_keys SET last_used_at = now() WHERE id = :key_id"),
        {"key_id": key_id}
    )
    await db.commit()


async def mark_key_invalid(db: AsyncSession, key_id: str) -> None:
    """Mark an API key as invalid (e.g., after auth failure)."""
    await db.execute(
        text("UPDATE exchange_api_keys SET is_valid = false, updated_at = now() WHERE id = :key_id"),
        {"key_id": key_id}
    )
    await db.commit()
    logger.warning(f"Marked API key {key_id} as invalid")

