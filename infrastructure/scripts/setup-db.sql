-- ============================================
-- JadeTrade Bot Engine Database Schema
-- Run this against your PostgreSQL database
-- ============================================

-- Enable pgvector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- API KEYS (Encrypted Exchange Credentials)
-- ============================================
CREATE TABLE IF NOT EXISTS exchange_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    exchange VARCHAR(50) NOT NULL, -- 'binance', 'bybit', 'coinbase'
    label VARCHAR(100), -- User-friendly name

    -- Encrypted credentials (AES-256-GCM)
    api_key_encrypted TEXT NOT NULL,
    api_secret_encrypted TEXT NOT NULL,
    passphrase_encrypted TEXT, -- For exchanges that require it

    -- Permissions
    is_read_only BOOLEAN DEFAULT true,
    can_trade BOOLEAN DEFAULT false,
    can_withdraw BOOLEAN DEFAULT false, -- Should NEVER be true

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_valid BOOLEAN DEFAULT true, -- Set to false if validation fails
    last_used_at TIMESTAMP,
    last_validated_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, exchange, label)
);

CREATE INDEX IF NOT EXISTS idx_exchange_api_keys_user ON exchange_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_exchange_api_keys_exchange ON exchange_api_keys(exchange);

-- ============================================
-- REAL POSITIONS (Live Exchange Positions)
-- ============================================
CREATE TABLE IF NOT EXISTS real_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES exchange_api_keys(id) ON DELETE SET NULL,

    exchange VARCHAR(50) NOT NULL,
    symbol VARCHAR(50) NOT NULL, -- 'BTCUSDT'
    side VARCHAR(10) NOT NULL, -- 'long', 'short'
    status VARCHAR(20) DEFAULT 'open', -- 'open', 'closed'

    -- Position details
    entry_price DECIMAL(20, 8) NOT NULL,
    current_price DECIMAL(20, 8),
    quantity DECIMAL(20, 8) NOT NULL,
    leverage INTEGER DEFAULT 1,

    -- Risk management
    stop_loss DECIMAL(20, 8),
    take_profit DECIMAL(20, 8),
    trailing_stop_percent DECIMAL(5, 2),

    -- P&L
    unrealized_pnl DECIMAL(20, 8),
    unrealized_pnl_percent DECIMAL(10, 4),
    realized_pnl DECIMAL(20, 8), -- Set when closed

    -- Margin (for futures)
    margin DECIMAL(20, 8),
    liquidation_price DECIMAL(20, 8),

    -- Source
    signal_id UUID,
    strategy_id UUID REFERENCES strategies(id),

    -- Exchange reference
    exchange_position_id VARCHAR(255),

    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_real_positions_user ON real_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_real_positions_status ON real_positions(status);
CREATE INDEX IF NOT EXISTS idx_real_positions_symbol ON real_positions(symbol);
CREATE INDEX IF NOT EXISTS idx_real_positions_strategy ON real_positions(strategy_id);

-- ============================================
-- REAL TRADES (Live Exchange Trades)
-- ============================================
CREATE TABLE IF NOT EXISTS real_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES exchange_api_keys(id) ON DELETE SET NULL,
    position_id UUID REFERENCES real_positions(id) ON DELETE SET NULL,

    exchange VARCHAR(50) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    side VARCHAR(10) NOT NULL, -- 'buy', 'sell'
    order_type VARCHAR(20) NOT NULL, -- 'market', 'limit', 'stop_market'

    -- Order details
    quantity DECIMAL(20, 8) NOT NULL,
    price DECIMAL(20, 8), -- Null for market orders until filled
    filled_quantity DECIMAL(20, 8) DEFAULT 0,
    avg_fill_price DECIMAL(20, 8),

    -- Fees
    fee DECIMAL(20, 8),
    fee_currency VARCHAR(20),

    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'filled', 'partially_filled', 'canceled', 'failed'

    -- Exchange reference
    exchange_order_id VARCHAR(255),

    -- Source
    signal_id UUID,
    strategy_id UUID REFERENCES strategies(id),

    -- P&L (for closing trades)
    realized_pnl DECIMAL(20, 8),
    realized_pnl_percent DECIMAL(10, 4),

    executed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_real_trades_user ON real_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_real_trades_status ON real_trades(status);
CREATE INDEX IF NOT EXISTS idx_real_trades_symbol ON real_trades(symbol);
CREATE INDEX IF NOT EXISTS idx_real_trades_position ON real_trades(position_id);
CREATE INDEX IF NOT EXISTS idx_real_trades_created ON real_trades(created_at);

-- ============================================
-- TRADING SIGNALS (Enhanced)
-- ============================================
CREATE TABLE IF NOT EXISTS trading_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,

    -- Signal details
    signal_type VARCHAR(20) NOT NULL, -- 'long_entry', 'long_exit', 'short_entry', 'short_exit'
    symbol VARCHAR(50) NOT NULL,
    exchange VARCHAR(50),

    -- Price info
    price DECIMAL(20, 8),
    suggested_entry DECIMAL(20, 8),
    suggested_stop_loss DECIMAL(20, 8),
    suggested_take_profit DECIMAL(20, 8),

    -- Source
    source VARCHAR(50) DEFAULT 'tradingview', -- 'tradingview', 'internal', 'manual'
    raw_payload JSONB,

    -- Processing
    status VARCHAR(20) DEFAULT 'received', -- 'received', 'validated', 'queued', 'executed', 'failed', 'skipped'
    processed_at TIMESTAMP,
    execution_result JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trading_signals_user ON trading_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_signals_strategy ON trading_signals(strategy_id);
CREATE INDEX IF NOT EXISTS idx_trading_signals_status ON trading_signals(status);
CREATE INDEX IF NOT EXISTS idx_trading_signals_created ON trading_signals(created_at);

-- ============================================
-- BOT EXECUTION LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS bot_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signal_id UUID REFERENCES trading_signals(id),
    trade_id UUID REFERENCES real_trades(id),

    -- Execution details
    status VARCHAR(20) NOT NULL, -- 'queued', 'running', 'completed', 'failed'

    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,

    -- Risk check
    risk_check_passed BOOLEAN,
    risk_check_details JSONB,

    -- Result
    trade_executed BOOLEAN DEFAULT false,

    -- Error handling
    error_type VARCHAR(100),
    error_message TEXT,
    error_stack TEXT,
    retry_count INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bot_execution_user ON bot_execution_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_execution_status ON bot_execution_logs(status);
CREATE INDEX IF NOT EXISTS idx_bot_execution_created ON bot_execution_logs(created_at);

-- ============================================
-- RISK SETTINGS (Per-User)
-- ============================================
CREATE TABLE IF NOT EXISTS user_risk_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- Global limits
    max_position_size_usd DECIMAL(20, 2) DEFAULT 1000,
    max_leverage INTEGER DEFAULT 10,
    max_open_positions INTEGER DEFAULT 5,
    max_daily_trades INTEGER DEFAULT 50,
    max_daily_loss_percent DECIMAL(5, 2) DEFAULT 10,
    max_portfolio_exposure_percent DECIMAL(5, 2) DEFAULT 80,

    -- Per-trade settings
    default_risk_per_trade_percent DECIMAL(5, 2) DEFAULT 2,
    require_stop_loss BOOLEAN DEFAULT true,

    -- Notifications
    notify_on_trade BOOLEAN DEFAULT true,
    notify_on_stop_loss BOOLEAN DEFAULT true,
    notify_on_daily_loss_limit BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CHAT MESSAGES (AI Chatbot)
-- ============================================
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,

    -- Token usage (for billing tracking)
    input_tokens INTEGER,
    output_tokens INTEGER,

    -- Context used
    context_summary TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

-- ============================================
-- KNOWLEDGE BASE EMBEDDINGS (AI RAG)
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source document
    source_type VARCHAR(50) NOT NULL, -- 'docs', 'faq', 'strategy', 'guide'
    source_id VARCHAR(255),
    title VARCHAR(500),

    -- Content
    content TEXT NOT NULL,
    content_hash VARCHAR(64), -- For deduplication

    -- Vector embedding (1536 dimensions for OpenAI, 1024 for Claude)
    embedding vector(1536),

    -- Metadata
    metadata JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_source ON knowledge_embeddings(source_type);
-- Note: Run this after inserting data for better performance
-- CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_vector ON knowledge_embeddings USING ivfflat (embedding vector_cosine_ops);

-- ============================================
-- AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,

    action VARCHAR(100) NOT NULL, -- 'api_key.create', 'trade.execute', 'settings.update'
    resource_type VARCHAR(50), -- 'api_key', 'trade', 'position', 'settings'
    resource_id VARCHAR(255),

    -- Request details
    ip_address INET,
    user_agent TEXT,

    -- Changes
    old_value JSONB,
    new_value JSONB,

    -- Result
    success BOOLEAN DEFAULT true,
    error_message TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    type VARCHAR(50) NOT NULL, -- 'trade_executed', 'stop_loss_hit', 'daily_summary', 'system'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    -- Related entity
    related_type VARCHAR(50), -- 'trade', 'position', 'signal'
    related_id VARCHAR(255),

    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,

    -- Delivery
    email_sent BOOLEAN DEFAULT false,
    push_sent BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- ============================================
-- PRICE HISTORY (For backtesting)
-- ============================================
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    symbol VARCHAR(50) NOT NULL,
    exchange VARCHAR(50) NOT NULL,
    timeframe VARCHAR(10) NOT NULL, -- '1m', '5m', '15m', '1h', '4h', '1d'

    open_time TIMESTAMP NOT NULL,
    open DECIMAL(20, 8) NOT NULL,
    high DECIMAL(20, 8) NOT NULL,
    low DECIMAL(20, 8) NOT NULL,
    close DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(30, 8),

    UNIQUE(symbol, exchange, timeframe, open_time)
);

CREATE INDEX IF NOT EXISTS idx_price_history_lookup ON price_history(symbol, exchange, timeframe, open_time);

-- ============================================
-- UPDATE users TABLE (add new columns)
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_messages_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_messages_limit INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_enabled BOOLEAN DEFAULT false;

-- ============================================
-- UPDATE strategies TABLE (add new columns)
-- ============================================
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS min_tier VARCHAR(20) DEFAULT 'free';
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS supported_exchanges TEXT[] DEFAULT ARRAY['binance'];
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20) DEFAULT 'medium';
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS timeframe VARCHAR(10) DEFAULT '1h';

-- ============================================
-- UPDATE strategy_subscriptions TABLE (add exchange key link)
-- ============================================
ALTER TABLE strategy_subscriptions ADD COLUMN IF NOT EXISTS exchange_key_id UUID REFERENCES exchange_api_keys(id) ON DELETE SET NULL;

-- ============================================
-- Done!
-- ============================================
