import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Plus, Link2, ChevronDown,
  Bot, LogOut, Shield, Grid3X3, Webhook, DollarSign,
  ArrowUpRight, Sparkles, Settings, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

// Mock price data - in production this would come from a WebSocket
const usePrices = () => {
  const [prices, setPrices] = useState({
    btc: { price: 97234.52, change: 2.31 },
    eth: { price: 3892.16, change: -1.17 },
  });

  useEffect(() => {
    // Simulate price updates
    const interval = setInterval(() => {
      setPrices(prev => ({
        btc: {
          price: prev.btc.price + (Math.random() - 0.5) * 100,
          change: prev.btc.change + (Math.random() - 0.5) * 0.1
        },
        eth: {
          price: prev.eth.price + (Math.random() - 0.5) * 10,
          change: prev.eth.change + (Math.random() - 0.5) * 0.1
        },
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return prices;
};

const EXCHANGES = [
  { id: 'coinbase', name: 'Coinbase Spot', types: 'Spot', color: '#0052FF' },
  { id: 'kraken', name: 'Kraken', types: 'Spot', color: '#5741D9' },
  { id: 'binance-us', name: 'Binance US', types: 'Spot', color: '#F0B90B' },
  { id: 'okx', name: 'OKX', types: 'Spot | Futures', color: '#000000' },
  { id: 'bybit', name: 'Bybit', types: 'Spot | Futures', color: '#F7A600' },
  { id: 'binance', name: 'Binance', types: 'Spot | Futures | Margin', color: '#F0B90B' },
];

const BOT_TYPES = [
  {
    id: 'dca',
    name: 'DCA Bot',
    icon: DollarSign,
    description: 'Supercharged dollar-cost averaging strategy with a wide range of advanced settings.',
    tags: ['Tech. indicators', 'Multi-pair', 'Reinvest', 'Webhooks'],
    badge: 'Backtest 183 days',
    badgeColor: 'text-cyan-400',
  },
  {
    id: 'signal',
    name: 'Signal Bot',
    icon: Webhook,
    description: 'Execute your strategy using webhook signals from any source or using a TradingView Strategy.',
    tags: ['Custom signal', 'PineScript', 'Webhooks'],
    badgeColor: 'text-yellow-400',
  },
  {
    id: 'grid',
    name: 'GRID Bot',
    icon: Grid3X3,
    description: 'Capitalize on every market price movement by adapting to any price level range.',
    tags: ['Backtest', 'AI optimization', 'Trailing', 'Expanding'],
    badgeColor: 'text-purple-400',
  },
];

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const prices = usePrices();
  const [activeTab, setActiveTab] = useState<'main' | 'guide'>('main');
  const [botTab, setBotTab] = useState<'bots' | 'manual'>('bots');
  const [showMoreExchanges, setShowMoreExchanges] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    toast({ title: 'Signed out successfully' });
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const displayedExchanges = showMoreExchanges ? EXCHANGES : EXCHANGES.slice(0, 3);

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Top Price Ticker Bar */}
      <div className="border-b border-border/50 bg-[#161b22]">
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* BTC Price */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">BTC/USD</span>
              <span className="text-sm font-mono font-medium">
                ${prices.btc.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-xs ${prices.btc.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {prices.btc.change >= 0 ? '+' : ''}{prices.btc.change.toFixed(2)}%
              </span>
            </div>
            {/* ETH Price */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">ETH/USD</span>
              <span className="text-sm font-mono font-medium">
                ${prices.eth.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-xs ${prices.eth.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {prices.eth.change >= 0 ? '+' : ''}{prices.eth.change.toFixed(2)}%
              </span>
            </div>
            <button className="text-xs text-cyan-400 hover:text-cyan-300">View Options ↓</button>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>$0</span>
              <span className="text-yellow-500">≈0 BTC</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-border/50 hover:bg-white/5"
              onClick={() => navigate('/bots/create')}
            >
              <Plus className="w-4 h-4 mr-1" />
              Start new bot
            </Button>
            <Button
              size="sm"
              className="h-8 bg-cyan-500 hover:bg-cyan-600 text-black font-medium"
            >
              Start your 14-day free trial
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Free plan</span>
              <ChevronDown className="w-4 h-4" />
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSignOut}>
              <User className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-border/50 bg-[#0d1117]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="h-14 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                <img src="/jadetrade-logo.png" alt="JadeTrade" className="h-8 w-auto" />
              </div>
            </div>

            <nav className="flex items-center gap-1">
              {user?.isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/admin')}
                  className="text-primary"
                >
                  <Shield className="w-4 h-4 mr-1" />
                  Admin
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => navigate('/exchanges')}>
                Exchanges
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/bots')}>
                Marketplace
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </nav>
          </div>

          {/* Sub navigation */}
          <div className="flex items-center gap-6 -mb-px">
            <h1 className="text-xl font-semibold py-3">Dashboard</h1>
          </div>
          <div className="flex gap-6 border-b border-transparent">
            <button
              onClick={() => setActiveTab('main')}
              className={`pb-3 text-sm border-b-2 transition-colors ${
                activeTab === 'main'
                  ? 'text-foreground border-cyan-500'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              Main
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`pb-3 text-sm border-b-2 transition-colors ${
                activeTab === 'guide'
                  ? 'text-foreground border-cyan-500'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              Beginner's Guide
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Connect an Exchange Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-gradient-to-r from-[#1a2332] to-[#1a2332] border border-border/50 p-6 mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">Connect an exchange!</h2>
              <p className="text-muted-foreground text-sm max-w-lg">
                Experience rapid trade execution with a variety of DCA, Signal, GRID Bots, and SmartTrade options.
              </p>
            </div>
            <Button
              variant="outline"
              className="border-border/50 hover:bg-white/5"
              onClick={() => navigate('/exchanges')}
            >
              View all 16 exchanges
            </Button>
          </div>
        </motion.div>

        {/* Top Exchanges Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <h3 className="text-lg font-semibold mb-4">Top exchanges for your country</h3>
          <div className="rounded-xl border border-border/50 overflow-hidden bg-[#161b22]">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-muted-foreground border-b border-border/50">
                  <th className="px-4 py-3 font-medium">Exchange</th>
                  <th className="px-4 py-3 font-medium">Account types</th>
                  <th className="px-4 py-3 font-medium">Instruments</th>
                  <th className="px-4 py-3 font-medium">Connect existing account</th>
                  <th className="px-4 py-3 font-medium">Create new account</th>
                </tr>
              </thead>
              <tbody>
                {displayedExchanges.map((exchange) => (
                  <tr key={exchange.id} className="border-b border-border/30 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                          style={{ backgroundColor: exchange.color + '20', color: exchange.color }}
                        >
                          {exchange.name.charAt(0)}
                        </div>
                        <span className="font-medium">{exchange.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">{exchange.types}</td>
                    <td className="px-4 py-4 text-sm">
                      <span className="text-cyan-400">SmartTrade</span>
                      <span className="text-muted-foreground"> | </span>
                      <span className="text-cyan-400">DCA</span>
                      <span className="text-muted-foreground"> | </span>
                      <span className="text-cyan-400">GRID</span>
                      <span className="text-muted-foreground"> | </span>
                      <span className="text-yellow-400">Signal</span>
                    </td>
                    <td className="px-4 py-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                        onClick={() => navigate('/exchanges')}
                      >
                        <Link2 className="w-3 h-3 mr-1" />
                        Connect
                      </Button>
                    </td>
                    <td className="px-4 py-4">
                      <button className="text-sm text-muted-foreground hover:text-foreground">
                        + Create
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!showMoreExchanges && (
              <div className="px-4 py-3 border-t border-border/30">
                <button
                  onClick={() => setShowMoreExchanges(true)}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <ChevronDown className="w-4 h-4" />
                  Show more
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Start New Bot Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Start new bot</h3>
            <div className="flex items-center gap-2 bg-[#161b22] rounded-lg p-1">
              <button
                onClick={() => setBotTab('bots')}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                  botTab === 'bots'
                    ? 'bg-[#21262d] text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Bots
              </button>
              <button
                onClick={() => setBotTab('manual')}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                  botTab === 'manual'
                    ? 'bg-[#21262d] text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Manual tools
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {BOT_TYPES.map((bot) => (
              <motion.div
                key={bot.id}
                whileHover={{ scale: 1.02 }}
                className="rounded-xl border border-border/50 bg-[#161b22] p-5 cursor-pointer hover:border-cyan-500/50 transition-colors"
                onClick={() => navigate(`/bots/create?type=${bot.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#21262d] flex items-center justify-center">
                      <bot.icon className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{bot.name}</h4>
                      {bot.badge && (
                        <span className={`text-xs ${bot.badgeColor}`}>{bot.badge}</span>
                      )}
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {bot.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {bot.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-1 rounded bg-[#21262d] text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Dashboard;
