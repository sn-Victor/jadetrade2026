import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Gem, TrendingUp, TrendingDown, Wallet,
  Bot, LogOut, BarChart3, History, Settings, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Portfolio {
  id: string;
  name: string;
  balance: number;
  initial_balance: number;
}

interface Position {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  entry_price: number;
  current_price: number | null;
  unrealized_pnl: number | null;
}

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [activeBotsCount, setActiveBotsCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchPortfolioData();
      fetchActiveBotsCount();
    }
  }, [user]);

  const fetchPortfolioData = async () => {
    const { data: portfolioData } = await supabase
      .from('portfolios')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (portfolioData) {
      setPortfolio(portfolioData);

      const { data: positionsData } = await supabase
        .from('positions')
        .select('*')
        .eq('portfolio_id', portfolioData.id);

      setPositions(positionsData || []);
    }
  };

  const fetchActiveBotsCount = async () => {
    const { count } = await supabase
      .from('user_bot_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    setActiveBotsCount(count || 0);
  };

  const handleSignOut = async () => {
    await signOut();
    toast({ title: 'Signed out successfully' });
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  const totalPnL = portfolio ? portfolio.balance - portfolio.initial_balance : 0;
  const pnlPercentage = portfolio ? ((totalPnL / portfolio.initial_balance) * 100).toFixed(2) : '0';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Gem className="w-8 h-8 text-primary fill-primary/20" />
            </div>
            <span className="font-semibold text-lg bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">JadeTrade</span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <button className="text-sm text-foreground font-medium">Dashboard</button>
            <button
              onClick={() => navigate('/bots')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Strategy Marketplace
            </button>
            <button
              onClick={() => navigate('/exchanges')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Exchanges
            </button>
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Trade History
            </button>
            {user?.isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
              >
                <Shield className="w-4 h-4" />
                Admin
              </button>
            )}
          </nav>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden md:block">
              {user?.email}
            </span>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-semibold mb-2">
            Welcome back<span className="text-gradient">!</span>
          </h1>
          <p className="text-muted-foreground">
            Here's an overview of your trading portfolio
          </p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted-foreground text-sm">Portfolio Value</span>
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <p className="text-2xl font-semibold font-mono">
              ${portfolio?.balance?.toLocaleString() || '10,000.00'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Demo Account</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted-foreground text-sm">Total P&L</span>
              {totalPnL >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-500" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-500" />
              )}
            </div>
            <p className={`text-2xl font-semibold font-mono ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString()}
            </p>
            <p className={`text-xs mt-1 ${totalPnL >= 0 ? 'text-green-500/70' : 'text-red-500/70'}`}>
              {totalPnL >= 0 ? '+' : ''}{pnlPercentage}%
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted-foreground text-sm">Active Strategies</span>
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <p className="text-2xl font-semibold font-mono">{activeBotsCount}</p>
            <p className="text-xs text-muted-foreground mt-1">
              <button 
                onClick={() => navigate('/bots')}
                className="text-primary hover:underline"
              >
                Browse marketplace →
              </button>
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted-foreground text-sm">Open Positions</span>
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <p className="text-2xl font-semibold font-mono">{positions.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Across all assets</p>
          </motion.div>
        </div>

        {/* Open Positions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-xl p-6 mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Open Positions</h2>
            <Button variant="ghost" size="sm" className="text-primary">
              View All
            </Button>
          </div>

          {positions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b border-border">
                    <th className="pb-3 font-medium">Symbol</th>
                    <th className="pb-3 font-medium">Side</th>
                    <th className="pb-3 font-medium">Quantity</th>
                    <th className="pb-3 font-medium">Entry Price</th>
                    <th className="pb-3 font-medium">Current Price</th>
                    <th className="pb-3 font-medium text-right">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => (
                    <tr key={position.id} className="border-b border-border/50 last:border-0">
                      <td className="py-4 font-medium">{position.symbol}</td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          position.side === 'long' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                        }`}>
                          {position.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 font-mono">{position.quantity}</td>
                      <td className="py-4 font-mono">${position.entry_price}</td>
                      <td className="py-4 font-mono">${position.current_price || '-'}</td>
                      <td className={`py-4 font-mono text-right ${
                        (position.unrealized_pnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {(position.unrealized_pnl || 0) >= 0 ? '+' : ''}${position.unrealized_pnl || '0.00'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No open positions yet</p>
              <p className="text-sm mt-1">Subscribe to a trading strategy to start automated trading</p>
              <Button
                onClick={() => navigate('/bots')}
                className="button-gradient mt-4"
              >
                Browse Trading Strategies
              </Button>
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <button
            onClick={() => navigate('/bots')}
            className="glass rounded-xl p-6 text-left hover:bg-white/10 transition-colors group"
          >
            <Bot className="w-8 h-8 text-primary mb-4" />
            <h3 className="font-semibold mb-1">Strategy Marketplace</h3>
            <p className="text-sm text-muted-foreground">
              Browse and subscribe to trading algorithms
            </p>
          </button>

          <button className="glass rounded-xl p-6 text-left hover:bg-white/10 transition-colors group">
            <History className="w-8 h-8 text-primary mb-4" />
            <h3 className="font-semibold mb-1">Trade History</h3>
            <p className="text-sm text-muted-foreground">
              View your complete trading history
            </p>
          </button>

          <button className="glass rounded-xl p-6 text-left hover:bg-white/10 transition-colors group">
            <Settings className="w-8 h-8 text-primary mb-4" />
            <h3 className="font-semibold mb-1">Account Settings</h3>
            <p className="text-sm text-muted-foreground">
              Manage your profile and preferences
            </p>
          </button>
        </motion.div>
      </main>
    </div>
  );
};

export default Dashboard;