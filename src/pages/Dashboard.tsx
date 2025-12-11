import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, Reorder } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Plus, Link2, ChevronDown,
  Bot, LogOut, Shield, Grid3X3, Webhook, DollarSign,
  ArrowUpRight, Settings, User, Calendar, Search, RefreshCw,
  GripVertical, X, Check, SlidersHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { usePriceDisplay } from '@/hooks/usePrices';
import { useTickerPreferences } from '@/hooks/useTickerPreferences';

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
    badgeColor: 'text-emerald-400',
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

interface PriceChipProps {
  id: string;
  symbol: string;
  price: number;
  change: number;
  draggable?: boolean;
  onRemove?: () => void;
}

const PriceChip = ({ id, symbol, price, change, draggable, onRemove }: PriceChipProps) => (
  <motion.div
    layout
    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 flex-shrink-0 group cursor-grab active:cursor-grabbing"
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
  >
    {draggable && (
      <GripVertical className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground" />
    )}
    <span className="text-xs text-muted-foreground font-medium">{symbol}</span>
    <span className="text-sm font-mono font-semibold text-foreground">
      ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
    <span className={`text-xs font-medium flex items-center gap-0.5 ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
      {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {change >= 0 ? '+' : ''}{change.toFixed(2)}%
    </span>
    {onRemove && (
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="ml-1 p-0.5 rounded-full hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="w-3 h-3 text-muted-foreground hover:text-red-400" />
      </button>
    )}
  </motion.div>
);

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { priceList, loading: pricesLoading, error: pricesError, lastUpdated } = usePriceDisplay();
  const {
    preferences,
    initializeWithPrices,
    toggleTicker,
    reorderTickers,
    addTicker,
    removeTicker,
    getVisibleTickers,
    getHiddenTickers,
  } = useTickerPreferences();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'exchanges' | 'bots'>('dashboard');
  const [showMoreExchanges, setShowMoreExchanges] = useState(false);
  const [tokenSearch, setTokenSearch] = useState('');
  const [tickerSettingsOpen, setTickerSettingsOpen] = useState(false);
  const [visibleTickerIds, setVisibleTickerIds] = useState<string[]>([]);

  // Initialize ticker preferences when prices load
  useEffect(() => {
    if (priceList.length > 0 && !preferences) {
      initializeWithPrices(priceList);
    }
  }, [priceList, preferences, initializeWithPrices]);

  // Update visible ticker order when preferences change
  useEffect(() => {
    if (preferences) {
      const visible = getVisibleTickers();
      setVisibleTickerIds(visible.map(t => t.id));
    }
  }, [preferences, getVisibleTickers]);

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
  const userName = user?.email?.split('@')[0] || 'Trader';

  // Get prices for visible tickers in user's preferred order
  const getOrderedPrices = () => {
    if (!preferences || visibleTickerIds.length === 0) {
      // Fallback to first 6 by volume
      return priceList.slice(0, 6);
    }

    return visibleTickerIds
      .map(id => priceList.find(p => p.id === id))
      .filter(Boolean) as typeof priceList;
  };

  // Filter prices based on search (for settings popover)
  const filteredPrices = tokenSearch
    ? priceList.filter(p => p.symbol.toLowerCase().includes(tokenSearch.toLowerCase()))
    : priceList;

  // Get displayed prices (ordered by user preference or filtered by search)
  const displayedPrices = tokenSearch ? filteredPrices.slice(0, 8) : getOrderedPrices();

  // Handle reorder via drag and drop
  const handleReorder = (newOrder: string[]) => {
    setVisibleTickerIds(newOrder);
    // Find indices to call reorderTickers
    // For simplicity, we'll rebuild the order
    if (preferences) {
      const visibleTickers = getVisibleTickers();
      newOrder.forEach((id, newIndex) => {
        const oldIndex = visibleTickers.findIndex(t => t.id === id);
        if (oldIndex !== -1 && oldIndex !== newIndex) {
          reorderTickers(oldIndex, newIndex);
        }
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f0d] relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-emerald-600/8 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 right-0 w-[300px] h-[300px] bg-emerald-400/5 rounded-full blur-[80px]" />
      </div>

      {/* Top Navigation Bar */}
      <header className="relative z-10 border-b border-white/5 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6">
          <div className="h-16 flex items-center justify-between">
            {/* Logo & Nav */}
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                <img src="/jadetrade-logo.png" alt="JadeTrade" className="h-8 w-auto" />
              </div>

              <nav className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'dashboard'
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => navigate('/exchanges')}
                  className="px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  Exchanges
                </button>
                <button
                  onClick={() => navigate('/bots')}
                  className="px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  Marketplace
                </button>
                {user?.isAdmin && (
                  <button
                    onClick={() => navigate('/admin')}
                    className="px-4 py-2 text-sm font-medium rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors flex items-center gap-1"
                  >
                    <Shield className="w-4 h-4" />
                    Admin
                  </button>
                )}
              </nav>
            </div>

            {/* Right side - User */}
            <div className="flex items-center gap-4">
              <Button
                size="sm"
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold px-4"
                onClick={() => navigate('/bots/create')}
              >
                <Plus className="w-4 h-4 mr-1" />
                New Bot
              </Button>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-black font-semibold text-sm">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-muted-foreground">{user?.email}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Price Ticker Bar with Search */}
      <div className="relative z-10 border-b border-white/5 bg-black/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center gap-4">
            {/* Live indicator */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className={`w-2 h-2 rounded-full ${pricesLoading ? 'bg-yellow-400 animate-pulse' : pricesError ? 'bg-red-400' : 'bg-emerald-400 animate-pulse'}`} />
              <span className="text-xs text-muted-foreground">
                {pricesLoading ? 'Loading...' : pricesError ? 'Offline' : 'Live'}
              </span>
            </div>

            {/* Search input */}
            <div className="relative flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search token..."
                value={tokenSearch}
                onChange={(e) => setTokenSearch(e.target.value)}
                className="w-40 pl-9 pr-3 py-1.5 text-sm rounded-full bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50"
              />
            </div>

            {/* Price chips - draggable */}
            <Reorder.Group
              axis="x"
              values={visibleTickerIds}
              onReorder={setVisibleTickerIds}
              className="flex items-center gap-3 overflow-x-auto price-ticker scrollbar-hide flex-1"
            >
              {displayedPrices.map((p) => (
                <Reorder.Item key={p.id} value={p.id}>
                  <PriceChip
                    id={p.id}
                    symbol={p.symbol}
                    price={p.price}
                    change={p.change}
                    draggable={!tokenSearch}
                    onRemove={!tokenSearch ? () => removeTicker(p.id) : undefined}
                  />
                </Reorder.Item>
              ))}
            </Reorder.Group>

            {/* Settings button */}
            <Popover open={tickerSettingsOpen} onOpenChange={setTickerSettingsOpen}>
              <PopoverTrigger asChild>
                <button className="p-2 rounded-full hover:bg-white/5 transition-colors flex-shrink-0">
                  <SlidersHorizontal className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4 bg-[#0a0f0d] border-white/10" align="end">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Customize Ticker</h4>
                    <p className="text-xs text-muted-foreground">Drag chips to reorder. Click + to add tokens.</p>
                  </div>

                  {/* Available tokens */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Available tokens (sorted by volume)</p>
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                      {priceList.map((p) => {
                        const isVisible = visibleTickerIds.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => isVisible ? removeTicker(p.id) : addTicker(p.id)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                              isVisible
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-white/5 text-muted-foreground border border-white/10 hover:border-emerald-500/30 hover:text-foreground'
                            }`}
                          >
                            {isVisible ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                            {p.symbol.replace('/USD', '')}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                Welcome back, <span className="text-emerald-400">{userName}</span>
              </h1>
              <p className="text-muted-foreground">
                Here's a look at your trading performance and bots.
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Connect an Exchange Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent border border-emerald-500/20 p-6 mb-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">Connect an exchange to get started</h2>
              <p className="text-muted-foreground text-sm max-w-lg">
                Experience rapid trade execution with a variety of DCA, Signal, GRID Bots, and SmartTrade options.
              </p>
            </div>
            <Button
              className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
              onClick={() => navigate('/exchanges')}
            >
              <Link2 className="w-4 h-4 mr-2" />
              Connect Exchange
            </Button>
          </div>
        </motion.div>

        {/* Top Exchanges Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h3 className="text-lg font-semibold mb-4">Top exchanges for your country</h3>
          <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02] backdrop-blur-sm">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-muted-foreground border-b border-white/5">
                  <th className="px-5 py-4 font-medium">Exchange</th>
                  <th className="px-5 py-4 font-medium">Account types</th>
                  <th className="px-5 py-4 font-medium">Instruments</th>
                  <th className="px-5 py-4 font-medium">Connect existing account</th>
                  <th className="px-5 py-4 font-medium">Create new account</th>
                </tr>
              </thead>
              <tbody>
                {displayedExchanges.map((exchange, idx) => (
                  <tr key={exchange.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                          style={{ backgroundColor: exchange.color + '20', color: exchange.color }}
                        >
                          {exchange.name.charAt(0)}
                        </div>
                        <span className="font-medium">{exchange.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{exchange.types}</td>
                    <td className="px-5 py-4 text-sm">
                      <span className="text-emerald-400">SmartTrade</span>
                      <span className="text-muted-foreground"> | </span>
                      <span className="text-emerald-400">DCA</span>
                      <span className="text-muted-foreground"> | </span>
                      <span className="text-emerald-400">GRID</span>
                      <span className="text-muted-foreground"> | </span>
                      <span className="text-yellow-400">Signal</span>
                    </td>
                    <td className="px-5 py-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50"
                        onClick={() => navigate('/exchanges')}
                      >
                        <Link2 className="w-3 h-3 mr-1" />
                        Connect
                      </Button>
                    </td>
                    <td className="px-5 py-4">
                      <button className="text-sm text-muted-foreground hover:text-emerald-400 transition-colors">
                        + Create
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!showMoreExchanges && (
              <div className="px-5 py-3 border-t border-white/5">
                <button
                  onClick={() => setShowMoreExchanges(true)}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                  Show more exchanges
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Start New Bot Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Start new bot</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {BOT_TYPES.map((bot, idx) => (
              <motion.div
                key={bot.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + idx * 0.1 }}
                whileHover={{ scale: 1.02, y: -4 }}
                className="group rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-5 cursor-pointer hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] transition-all duration-300 relative overflow-hidden"
                onClick={() => navigate(`/bots/create?type=${bot.id}`)}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center">
                        <bot.icon className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-lg">{bot.name}</h4>
                        {bot.badge && (
                          <span className={`text-xs ${bot.badgeColor}`}>{bot.badge}</span>
                        )}
                      </div>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-muted-foreground group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {bot.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {bot.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-muted-foreground border border-white/5"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
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
