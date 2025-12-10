"""
Embeddings & RAG Module

Provides vector embeddings and knowledge base search for RAG functionality.
Uses OpenAI for embeddings (Claude doesn't have an embedding API).
"""
from typing import List, Dict, Optional, Any
import hashlib
import os

from app.logging.logger import get_logger

logger = get_logger("embeddings")

# Configuration
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536
MIN_SIMILARITY_THRESHOLD = 0.3


class EmbeddingProvider:
    """
    Provides embedding vectors using OpenAI's embedding API.

    Falls back to zero vectors if OpenAI is not configured,
    allowing the system to work without embeddings (no RAG).
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self._client = None

    @property
    def client(self):
        """Lazy initialization of OpenAI client"""
        if self._client is None and self.api_key:
            try:
                from openai import AsyncOpenAI
                self._client = AsyncOpenAI(api_key=self.api_key)
            except ImportError:
                logger.warning("openai package not installed. RAG will be disabled.")
                self._client = None
        return self._client

    async def get_embedding(self, text: str) -> List[float]:
        """
        Get embedding vector for text.

        Args:
            text: Text to embed

        Returns:
            Embedding vector (1536 dimensions for text-embedding-3-small)
        """
        if not self.client:
            # Return zero vector if OpenAI not configured
            logger.debug("OpenAI not configured, returning zero vector")
            return [0.0] * EMBEDDING_DIMENSIONS

        try:
            response = await self.client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=text,
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            return [0.0] * EMBEDDING_DIMENSIONS


# Singleton instance
_embedding_provider: Optional[EmbeddingProvider] = None


def get_embedding_provider() -> EmbeddingProvider:
    """Get or create the singleton EmbeddingProvider"""
    global _embedding_provider
    if _embedding_provider is None:
        _embedding_provider = EmbeddingProvider()
    return _embedding_provider


async def get_embedding(text: str) -> List[float]:
    """Get embedding vector for text (convenience function)"""
    provider = get_embedding_provider()
    return await provider.get_embedding(text)


async def search_knowledge_base(
    query: str,
    limit: int = 5,
    source_type: Optional[str] = None,
) -> List[Dict[str, str]]:
    """
    Search knowledge base using vector similarity.

    Uses pgvector for efficient similarity search when connected to database.
    Falls back to empty results if database not available.

    Args:
        query: Search query
        limit: Max results to return
        source_type: Filter by source type (docs, faq, strategy, guide)

    Returns:
        List of relevant documents with title, content, and similarity score
    """
    try:
        # Get query embedding
        query_embedding = await get_embedding(query)

        # Check if we have a valid embedding (not all zeros)
        if all(v == 0.0 for v in query_embedding[:10]):
            logger.debug("Zero embedding, skipping knowledge base search")
            return []

        # Try to search using database
        try:
            from app.core.database import get_db

            async with get_db() as db:
                # Build query with optional source_type filter
                if source_type:
                    sql = """
                        SELECT
                            title,
                            content,
                            source_type,
                            1 - (embedding <=> $1::vector) as similarity
                        FROM knowledge_embeddings
                        WHERE source_type = $2
                        ORDER BY embedding <=> $1::vector
                        LIMIT $3
                    """
                    results = await db.fetch(sql, query_embedding, source_type, limit)
                else:
                    sql = """
                        SELECT
                            title,
                            content,
                            source_type,
                            1 - (embedding <=> $1::vector) as similarity
                        FROM knowledge_embeddings
                        ORDER BY embedding <=> $1::vector
                        LIMIT $2
                    """
                    results = await db.fetch(sql, query_embedding, limit)

                return [
                    {
                        "title": row["title"],
                        "content": row["content"],
                        "source_type": row["source_type"],
                        "similarity": float(row["similarity"]),
                    }
                    for row in results
                    if row["similarity"] > MIN_SIMILARITY_THRESHOLD
                ]

        except ImportError:
            logger.debug("Database module not available")
            return []
        except Exception as e:
            logger.warning(f"Database search failed: {e}")
            return []

    except Exception as e:
        logger.error(f"Knowledge base search failed: {e}", exc_info=True)
        return []


async def index_document(
    source_type: str,
    source_id: str,
    title: str,
    content: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Index a document into the knowledge base.

    Args:
        source_type: Type of document (docs, faq, strategy, guide)
        source_id: Unique identifier within source type
        title: Document title
        content: Document content
        metadata: Additional metadata

    Returns:
        True if successful
    """
    try:
        # Generate content hash for deduplication
        content_hash = hashlib.sha256(content.encode()).hexdigest()

        # Get embedding for title + content
        embedding = await get_embedding(f"{title}\n\n{content}")

        try:
            from app.core.database import get_db
            import json

            async with get_db() as db:
                await db.execute(
                    """
                    INSERT INTO knowledge_embeddings (
                        source_type, source_id, title, content, content_hash, embedding, metadata
                    ) VALUES ($1, $2, $3, $4, $5, $6::vector, $7)
                    ON CONFLICT (source_type, source_id) DO UPDATE SET
                        title = EXCLUDED.title,
                        content = EXCLUDED.content,
                        content_hash = EXCLUDED.content_hash,
                        embedding = EXCLUDED.embedding,
                        metadata = EXCLUDED.metadata,
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    source_type,
                    source_id,
                    title,
                    content,
                    content_hash,
                    embedding,
                    json.dumps(metadata) if metadata else None,
                )

            logger.info(f"Indexed document: {source_type}/{source_id}")
            return True

        except ImportError:
            logger.warning("Database module not available, skipping index")
            return False
        except Exception as e:
            logger.error(f"Database insert failed: {e}")
            return False

    except Exception as e:
        logger.error(f"Failed to index document: {e}", exc_info=True)
        return False


async def delete_document(source_type: str, source_id: str) -> bool:
    """
    Delete a document from the knowledge base.

    Args:
        source_type: Type of document
        source_id: Document identifier

    Returns:
        True if successful
    """
    try:
        from app.core.database import get_db

        async with get_db() as db:
            await db.execute(
                "DELETE FROM knowledge_embeddings WHERE source_type = $1 AND source_id = $2",
                source_type,
                source_id,
            )

        logger.info(f"Deleted document: {source_type}/{source_id}")
        return True

    except Exception as e:
        logger.error(f"Failed to delete document: {e}")
        return False


# Pre-defined knowledge base content for initial seeding
DEFAULT_KNOWLEDGE_BASE = [
    {
        "source_type": "docs",
        "source_id": "getting-started",
        "title": "Getting Started with JadeTrade",
        "content": """
JadeTrade is an automated trading platform that connects to major exchanges like Binance and Bybit.

## Quick Start

1. **Create an Account**: Sign up at jadetrade.io
2. **Connect Your Exchange**: Add your API keys from Binance or Bybit
3. **Create a Strategy**: Set up your first trading bot with TradingView signals
4. **Go Live**: Enable your bot and start automated trading

## Features

- **TradingView Webhooks**: Receive signals from TradingView alerts
- **Risk Management**: Built-in position sizing and risk controls
- **Multi-Exchange**: Trade on Binance and Bybit simultaneously
- **Real-Time Monitoring**: Track all trades in your dashboard
        """,
    },
    {
        "source_type": "faq",
        "source_id": "api-keys",
        "title": "How to Set Up API Keys",
        "content": """
## Setting Up Exchange API Keys

### Binance

1. Log in to Binance
2. Go to API Management
3. Create a new API key
4. Enable "Spot & Margin Trading" and "Futures Trading"
5. Set IP whitelist for security (recommended)
6. Copy your API Key and Secret to JadeTrade

### Bybit

1. Log in to Bybit
2. Go to API Settings
3. Create a new API key
4. Select "Read-Write" permissions
5. Enable "Contract" for futures trading
6. Copy your API Key and Secret to JadeTrade

**Security Tips:**
- Never share your API secret
- Use IP whitelisting when possible
- Don't enable withdrawal permissions
        """,
    },
    {
        "source_type": "faq",
        "source_id": "subscription-tiers",
        "title": "Subscription Tiers Explained",
        "content": """
## JadeTrade Subscription Plans

### Free Tier
- 1 active strategy
- Demo trading only
- Basic analytics
- Community support

### Pro Tier ($29/month)
- 10 active strategies
- Live trading enabled
- Advanced analytics
- Priority support
- AI chat assistant (100 messages/month)

### Enterprise Tier ($99/month)
- Unlimited strategies
- Live trading enabled
- Full analytics suite
- Dedicated support
- AI chat assistant (unlimited)
- Custom webhooks
- API access
        """,
    },
    {
        "source_type": "guide",
        "source_id": "tradingview-setup",
        "title": "Setting Up TradingView Webhooks",
        "content": """
## TradingView Webhook Setup

### Step 1: Get Your Webhook URL

1. Go to your JadeTrade dashboard
2. Navigate to Strategies > Your Strategy
3. Copy the webhook URL

### Step 2: Create TradingView Alert

1. Open your chart in TradingView
2. Click "Alert" button
3. Set your alert conditions
4. In "Webhook URL", paste your JadeTrade webhook URL

### Step 3: Configure Alert Message

Use this JSON format in the alert message:

```json
{
    "strategy_id": "your-strategy-id",
    "secret": "your-webhook-secret",
    "symbol": "{{ticker}}",
    "action": "long_entry",
    "price": "{{close}}"
}
```

### Available Actions
- `long_entry`: Open a long position
- `long_exit`: Close a long position
- `short_entry`: Open a short position
- `short_exit`: Close a short position
        """,
    },
]


async def seed_knowledge_base() -> int:
    """
    Seed the knowledge base with default content.

    Returns:
        Number of documents indexed
    """
    indexed = 0
    for doc in DEFAULT_KNOWLEDGE_BASE:
        success = await index_document(
            source_type=doc["source_type"],
            source_id=doc["source_id"],
            title=doc["title"],
            content=doc["content"],
        )
        if success:
            indexed += 1

    logger.info(f"Seeded knowledge base with {indexed} documents")
    return indexed
