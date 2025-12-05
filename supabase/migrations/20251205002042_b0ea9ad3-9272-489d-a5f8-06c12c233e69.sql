-- Create subscription tier enum
CREATE TYPE public.subscription_tier AS ENUM ('free', 'pro', 'enterprise');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  subscription_tier subscription_tier DEFAULT 'free',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create trading bots table
CREATE TABLE public.trading_bots (
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

-- Create user bot subscriptions
CREATE TABLE public.user_bot_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bot_id UUID REFERENCES public.trading_bots(id) ON DELETE CASCADE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, bot_id)
);

-- Create portfolios table
CREATE TABLE public.portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Main Portfolio',
  balance DECIMAL(15,2) DEFAULT 10000.00,
  initial_balance DECIMAL(15,2) DEFAULT 10000.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create positions table (open trades)
CREATE TABLE public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long', 'short')),
  quantity DECIMAL(15,8) NOT NULL,
  entry_price DECIMAL(15,8) NOT NULL,
  current_price DECIMAL(15,8),
  unrealized_pnl DECIMAL(15,2) DEFAULT 0,
  bot_id UUID REFERENCES public.trading_bots(id),
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create trade history table
CREATE TABLE public.trade_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity DECIMAL(15,8) NOT NULL,
  entry_price DECIMAL(15,8) NOT NULL,
  exit_price DECIMAL(15,8) NOT NULL,
  pnl DECIMAL(15,2) NOT NULL,
  bot_id UUID REFERENCES public.trading_bots(id),
  closed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bot_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_history ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Trading bots policies (public read)
CREATE POLICY "Anyone can view active bots" ON public.trading_bots
  FOR SELECT USING (is_active = true);

-- User bot subscriptions policies
CREATE POLICY "Users can view their subscriptions" ON public.user_bot_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their subscriptions" ON public.user_bot_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Portfolio policies
CREATE POLICY "Users can view their portfolios" ON public.portfolios
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their portfolios" ON public.portfolios
  FOR ALL USING (auth.uid() = user_id);

-- Positions policies
CREATE POLICY "Users can view their positions" ON public.positions
  FOR SELECT USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their positions" ON public.positions
  FOR ALL USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

-- Trade history policies
CREATE POLICY "Users can view their trade history" ON public.trade_history
  FOR SELECT USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Create default portfolio for new user
  INSERT INTO public.portfolios (user_id, name)
  VALUES (NEW.id, 'Demo Portfolio');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert sample trading bots
INSERT INTO public.trading_bots (name, description, strategy_type, min_tier, monthly_return_avg, win_rate, max_drawdown) VALUES
('Momentum Alpha', 'High-frequency momentum strategy focusing on trending assets with strong volume confirmation.', 'Momentum', 'free', 8.5, 65.2, 12.3),
('Mean Reversion Pro', 'Statistical arbitrage strategy exploiting price mean reversion in volatile markets.', 'Mean Reversion', 'pro', 12.3, 72.1, 8.7),
('Trend Follower Elite', 'Multi-timeframe trend following with dynamic position sizing and risk management.', 'Trend Following', 'pro', 15.8, 58.4, 15.2),
('Arbitrage Master', 'Cross-exchange arbitrage capturing price inefficiencies across multiple venues.', 'Arbitrage', 'enterprise', 22.4, 89.3, 3.2),
('AI Sentiment Trader', 'Machine learning model analyzing social sentiment and news for trade signals.', 'AI/ML', 'enterprise', 18.9, 67.8, 10.5),
('Grid Bot Basic', 'Simple grid trading strategy for ranging markets with automated buy/sell levels.', 'Grid', 'free', 5.2, 78.9, 6.1);