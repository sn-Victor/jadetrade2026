CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'enterprise');

CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  subscription_tier subscription_tier DEFAULT 'free',
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE trading_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  strategy_type TEXT NOT NULL,
  min_tier subscription_tier DEFAULT 'free',
  monthly_return_avg DECIMAL(5,2),
  win_rate DECIMAL(5,2),
  max_drawdown DECIMAL(5,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE user_bot_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  bot_id UUID REFERENCES trading_bots(id) ON DELETE CASCADE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, bot_id)
);

CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Main Portfolio',
  balance DECIMAL(15,2) DEFAULT 10000.00,
  initial_balance DECIMAL(15,2) DEFAULT 10000.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long', 'short')),
  quantity DECIMAL(15,8) NOT NULL,
  entry_price DECIMAL(15,8) NOT NULL,
  current_price DECIMAL(15,8),
  unrealized_pnl DECIMAL(15,2) DEFAULT 0,
  bot_id UUID REFERENCES trading_bots(id),
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE trade_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity DECIMAL(15,8) NOT NULL,
  entry_price DECIMAL(15,8) NOT NULL,
  exit_price DECIMAL(15,8) NOT NULL,
  pnl DECIMAL(15,2) NOT NULL,
  bot_id UUID REFERENCES trading_bots(id),
  closed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_invoice_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX idx_portfolios_user ON portfolios(user_id);
CREATE INDEX idx_positions_portfolio ON positions(portfolio_id);
CREATE INDEX idx_trade_history_portfolio ON trade_history(portfolio_id);
CREATE INDEX idx_user_bot_subs_user ON user_bot_subscriptions(user_id);
CREATE INDEX idx_payment_history_user ON payment_history(user_id);