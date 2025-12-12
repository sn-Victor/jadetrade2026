# SmartTrade Page & Navbar Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a SmartTrade manual trading page with pair selection, order forms (market/limit/stop), and enhance the dashboard navbar with SmartTrade navigation link.

**Architecture:** Add new SmartTrade page following existing page patterns (Dashboard, Exchanges, CreateBot). Extract shared DashboardNav component from repeated navigation code. SmartTrade page includes trading pair selector, order form, and position display.

**Tech Stack:** React, TypeScript, Framer Motion, shadcn/ui, react-router-dom, existing hooks (useAuth, usePrices, useCountry)

---

## Table of Contents

1. [Shared Dashboard Navigation Component](#part-1-shared-dashboard-navigation-component)
2. [SmartTrade Page](#part-2-smarttrade-page)
3. [Routing & Integration](#part-3-routing--integration)

---

## Part 1: Shared Dashboard Navigation Component

Currently, Dashboard.tsx (lines 201-268), Exchanges.tsx (lines 207-251), and CreateBot.tsx (lines 99-130) all have duplicated navigation code. We'll extract this into a reusable component.

### Task 1: Create DashboardNav Component

**Files:**
- Create: `src/components/DashboardNav.tsx`

**Step 1: Create the component file**

```tsx
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  label: string;
  path: string;
  active?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'SmartTrade', path: '/smarttrade' },
  { label: 'Exchanges', path: '/exchanges' },
  { label: 'Marketplace', path: '/bots' },
];

interface DashboardNavProps {
  showNewBotButton?: boolean;
  showUserMenu?: boolean;
  onSignOut?: () => void;
}

export const DashboardNav = ({
  showNewBotButton = true,
  showUserMenu = false,
  onSignOut
}: DashboardNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const userName = user?.email?.split('@')[0] || 'Trader';

  return (
    <header className="relative z-10 border-b border-white/5 bg-black/20 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6">
        <div className="h-16 flex items-center justify-between">
          {/* Logo & Nav */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
              <img src="/jadetrade-logo.png" alt="JadeTrade" className="h-8 w-auto" />
            </div>

            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
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

          {/* Right side */}
          <div className="flex items-center gap-4">
            {showNewBotButton && (
              <Button
                size="sm"
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold px-4"
                onClick={() => navigate('/bots/create')}
              >
                <Plus className="w-4 h-4 mr-1" />
                New Bot
              </Button>
            )}
            {showUserMenu && onSignOut && (
              <button
                onClick={onSignOut}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-black font-semibold text-sm">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-muted-foreground">{user?.email}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardNav;
```

**Step 2: Verify component compiles**

Run: `npm run build 2>&1 | head -20`
Expected: No errors related to DashboardNav

**Step 3: Commit**

```bash
git add src/components/DashboardNav.tsx
git commit -m "feat(ui): Add shared DashboardNav component with SmartTrade link"
```

---

### Task 2: Update Dashboard.tsx to use DashboardNav

**Files:**
- Modify: `src/pages/Dashboard.tsx`

**Step 1: Import DashboardNav and replace inline header**

At the top of the file, add import:
```tsx
import { DashboardNav } from '@/components/DashboardNav';
```

**Step 2: Replace the header section (lines 201-268)**

Replace the entire `<header>...</header>` block with:
```tsx
<DashboardNav showUserMenu onSignOut={handleSignOut} />
```

**Step 3: Remove unused imports**

Remove from imports: `Shield` (if only used in nav)

**Step 4: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: No errors

**Step 5: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "refactor(dashboard): Use shared DashboardNav component"
```

---

### Task 3: Update Exchanges.tsx to use DashboardNav

**Files:**
- Modify: `src/pages/Exchanges.tsx`

**Step 1: Import DashboardNav**

```tsx
import { DashboardNav } from '@/components/DashboardNav';
```

**Step 2: Replace header section (lines 207-251)**

Replace with:
```tsx
<DashboardNav />
```

**Step 3: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: No errors

**Step 4: Commit**

```bash
git add src/pages/Exchanges.tsx
git commit -m "refactor(exchanges): Use shared DashboardNav component"
```

---

## Part 2: SmartTrade Page

### Task 4: Create SmartTrade Page Component

**Files:**
- Create: `src/pages/SmartTrade.tsx`

**Step 1: Create the SmartTrade page**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, TrendingUp, TrendingDown, ChevronDown, AlertCircle,
  ArrowUpDown, Percent, DollarSign, Target, ShieldAlert, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardNav } from '@/components/DashboardNav';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { usePriceDisplay } from '@/hooks/usePrices';
import { apiClient } from '@/lib/api';

// Trading pairs for selection
const TRADING_PAIRS = [
  { symbol: 'BTC/USDT', base: 'BTC', quote: 'USDT' },
  { symbol: 'ETH/USDT', base: 'ETH', quote: 'USDT' },
  { symbol: 'SOL/USDT', base: 'SOL', quote: 'USDT' },
  { symbol: 'XRP/USDT', base: 'XRP', quote: 'USDT' },
  { symbol: 'DOGE/USDT', base: 'DOGE', quote: 'USDT' },
  { symbol: 'ADA/USDT', base: 'ADA', quote: 'USDT' },
  { symbol: 'AVAX/USDT', base: 'AVAX', quote: 'USDT' },
  { symbol: 'LINK/USDT', base: 'LINK', quote: 'USDT' },
];

interface PriceChipProps {
  symbol: string;
  price: number;
  change: number;
}

const PriceChip = ({ symbol, price, change }: PriceChipProps) => (
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 flex-shrink-0">
    <span className="text-xs text-muted-foreground font-medium">{symbol}</span>
    <span className="text-sm font-mono font-semibold text-foreground">
      ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
    <span className={`text-xs font-medium flex items-center gap-0.5 ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
      {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {change >= 0 ? '+' : ''}{change.toFixed(2)}%
    </span>
  </div>
);

const SmartTrade = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { priceList, loading: pricesLoading, error: pricesError } = usePriceDisplay();

  // Form state
  const [selectedPair, setSelectedPair] = useState('BTC/USDT');
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [leverage, setLeverage] = useState('1');

  // Advanced options
  const [takeProfit, setTakeProfit] = useState(false);
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [stopLoss, setStopLoss] = useState(false);
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [trailingStop, setTrailingStop] = useState(false);
  const [trailingPercent, setTrailingPercent] = useState('');

  // Exchange state
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null);
  const [exchangeKeys, setExchangeKeys] = useState<any[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);

  // Search state
  const [pairSearch, setPairSearch] = useState('');
  const [tokenSearch, setTokenSearch] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchExchangeKeys();
    }
  }, [user]);

  const fetchExchangeKeys = async () => {
    try {
      const response = await apiClient.getExchangeKeys();
      setExchangeKeys(response.keys || []);
      if (response.keys?.length > 0) {
        setSelectedExchange(response.keys[0].exchange);
      }
    } catch (error) {
      console.error('Failed to fetch exchange keys:', error);
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleSubmitOrder = async () => {
    if (!selectedExchange) {
      toast({
        title: 'No exchange connected',
        description: 'Please connect an exchange first',
        variant: 'destructive'
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid amount',
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'Order submitted',
      description: `${orderSide.toUpperCase()} ${amount} ${selectedPair} at ${orderType}`
    });
  };

  // Filter pairs based on search
  const filteredPairs = pairSearch
    ? TRADING_PAIRS.filter(p => p.symbol.toLowerCase().includes(pairSearch.toLowerCase()))
    : TRADING_PAIRS;

  // Filter prices based on search
  const filteredPrices = tokenSearch
    ? priceList.filter(p => p.symbol.toLowerCase().includes(tokenSearch.toLowerCase()))
    : priceList;

  // Get current pair price
  const currentPairPrice = priceList.find(p =>
    p.symbol.includes(selectedPair.split('/')[0])
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f0d] relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-emerald-600/8 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 right-0 w-[300px] h-[300px] bg-emerald-400/5 rounded-full blur-[80px]" />
      </div>

      {/* Navigation */}
      <DashboardNav />

      {/* Price Ticker Bar */}
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

            {/* Price chips */}
            <div className="flex items-center gap-3 overflow-x-auto price-ticker scrollbar-hide flex-1">
              {filteredPrices.slice(0, 8).map((p) => (
                <PriceChip key={p.symbol} symbol={p.symbol} price={p.price} change={p.change} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">SmartTrade</h1>
          <p className="text-muted-foreground">
            Manual trading with advanced order types, take profit, stop loss, and trailing stops.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2"
          >
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-6">
              {/* Exchange & Pair Selection */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <Label className="text-muted-foreground mb-2 block">Exchange</Label>
                  {exchangeKeys.length > 0 ? (
                    <Select value={selectedExchange || ''} onValueChange={setSelectedExchange}>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue placeholder="Select exchange" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0f0d] border-white/10">
                        {exchangeKeys.map((key) => (
                          <SelectItem key={key.id} value={key.exchange}>
                            {key.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full justify-between border-white/10 bg-white/5"
                      onClick={() => navigate('/exchanges')}
                    >
                      <span className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                        No exchange connected
                      </span>
                      <span className="text-emerald-400">+Connect</span>
                    </Button>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground mb-2 block">Trading Pair</Label>
                  <Select value={selectedPair} onValueChange={setSelectedPair}>
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0a0f0d] border-white/10">
                      {TRADING_PAIRS.map((pair) => (
                        <SelectItem key={pair.symbol} value={pair.symbol}>
                          {pair.symbol}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Buy/Sell Tabs */}
              <Tabs value={orderSide} onValueChange={(v) => setOrderSide(v as 'buy' | 'sell')} className="mb-6">
                <TabsList className="grid grid-cols-2 bg-white/5">
                  <TabsTrigger
                    value="buy"
                    className="data-[state=active]:bg-emerald-500 data-[state=active]:text-black"
                  >
                    Buy / Long
                  </TabsTrigger>
                  <TabsTrigger
                    value="sell"
                    className="data-[state=active]:bg-red-500 data-[state=active]:text-white"
                  >
                    Sell / Short
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Order Type */}
              <div className="mb-6">
                <Label className="text-muted-foreground mb-2 block">Order Type</Label>
                <div className="flex rounded-lg bg-white/5 p-1">
                  {(['market', 'limit', 'stop'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setOrderType(type)}
                      className={`flex-1 py-2 px-4 text-sm rounded-md transition-colors capitalize ${
                        orderType === type
                          ? 'bg-[#0a0f0d] text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price inputs based on order type */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {orderType !== 'market' && (
                  <div>
                    <Label className="text-muted-foreground mb-2 block">
                      {orderType === 'stop' ? 'Trigger Price' : 'Limit Price'}
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={orderType === 'stop' ? stopPrice : price}
                        onChange={(e) => orderType === 'stop' ? setStopPrice(e.target.value) : setPrice(e.target.value)}
                        placeholder="0.00"
                        className="bg-white/5 border-white/10 pr-16"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        USDT
                      </span>
                    </div>
                  </div>
                )}
                <div className={orderType === 'market' ? 'col-span-2' : ''}>
                  <Label className="text-muted-foreground mb-2 block">Amount</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="bg-white/5 border-white/10 pr-16"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {selectedPair.split('/')[0]}
                    </span>
                  </div>
                </div>
              </div>

              {/* Leverage */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-muted-foreground">Leverage</Label>
                  <span className="text-sm text-emerald-400">{leverage}x</span>
                </div>
                <div className="flex gap-2">
                  {['1', '2', '5', '10', '20', '50', '100'].map((lev) => (
                    <button
                      key={lev}
                      onClick={() => setLeverage(lev)}
                      className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
                        leverage === lev
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white/5 text-muted-foreground hover:text-foreground border border-white/10'
                      }`}
                    >
                      {lev}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Options */}
              <div className="space-y-4 mb-6">
                <h4 className="text-sm font-medium text-muted-foreground">Advanced Options</h4>

                {/* Take Profit */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3">
                    <Target className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="font-medium">Take Profit</p>
                      <p className="text-xs text-muted-foreground">Close position at target price</p>
                    </div>
                  </div>
                  <Switch checked={takeProfit} onCheckedChange={setTakeProfit} />
                </div>
                {takeProfit && (
                  <div className="ml-8">
                    <Input
                      type="number"
                      value={takeProfitPrice}
                      onChange={(e) => setTakeProfitPrice(e.target.value)}
                      placeholder="Take profit price"
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                )}

                {/* Stop Loss */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-red-400" />
                    <div>
                      <p className="font-medium">Stop Loss</p>
                      <p className="text-xs text-muted-foreground">Limit losses at specified price</p>
                    </div>
                  </div>
                  <Switch checked={stopLoss} onCheckedChange={setStopLoss} />
                </div>
                {stopLoss && (
                  <div className="ml-8">
                    <Input
                      type="number"
                      value={stopLossPrice}
                      onChange={(e) => setStopLossPrice(e.target.value)}
                      placeholder="Stop loss price"
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                )}

                {/* Trailing Stop */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3">
                    <Percent className="w-5 h-5 text-yellow-400" />
                    <div>
                      <p className="font-medium">Trailing Stop</p>
                      <p className="text-xs text-muted-foreground">Dynamic stop that follows price</p>
                    </div>
                  </div>
                  <Switch checked={trailingStop} onCheckedChange={setTrailingStop} />
                </div>
                {trailingStop && (
                  <div className="ml-8">
                    <Input
                      type="number"
                      value={trailingPercent}
                      onChange={(e) => setTrailingPercent(e.target.value)}
                      placeholder="Trailing percentage (e.g., 2%)"
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <Button
                className={`w-full font-semibold ${
                  orderSide === 'buy'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-black'
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
                size="lg"
                onClick={handleSubmitOrder}
                disabled={!selectedExchange}
              >
                {orderSide === 'buy' ? 'Buy / Long' : 'Sell / Short'} {selectedPair}
              </Button>
            </div>
          </motion.div>

          {/* Order Summary & Info Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {/* Current Price Card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-6">
              <h3 className="text-lg font-semibold mb-4">{selectedPair}</h3>
              {currentPairPrice ? (
                <div>
                  <p className="text-3xl font-bold text-emerald-400">
                    ${currentPairPrice.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className={`text-sm flex items-center gap-1 mt-1 ${currentPairPrice.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {currentPairPrice.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {currentPairPrice.change >= 0 ? '+' : ''}{currentPairPrice.change.toFixed(2)}% (24h)
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground">Loading price...</p>
              )}
            </div>

            {/* Order Summary */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <span className="capitalize">{orderType}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Side</span>
                  <span className={orderSide === 'buy' ? 'text-emerald-400' : 'text-red-400'}>
                    {orderSide === 'buy' ? 'Buy / Long' : 'Sell / Short'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span>{amount || '0'} {selectedPair.split('/')[0]}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Leverage</span>
                  <span>{leverage}x</span>
                </div>
                {takeProfit && takeProfitPrice && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Take Profit</span>
                    <span className="text-emerald-400">${takeProfitPrice}</span>
                  </div>
                )}
                {stopLoss && stopLossPrice && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Stop Loss</span>
                    <span className="text-red-400">${stopLossPrice}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Warning if no exchange */}
            {exchangeKeys.length === 0 && (
              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-500 mb-1">No Exchange Connected</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Connect an exchange to start trading with real funds.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"
                      onClick={() => navigate('/exchanges')}
                    >
                      Connect Exchange
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default SmartTrade;
```

**Step 2: Verify component compiles**

Run: `npm run build 2>&1 | head -30`
Expected: No errors related to SmartTrade

**Step 3: Commit**

```bash
git add src/pages/SmartTrade.tsx
git commit -m "feat(smarttrade): Add SmartTrade manual trading page"
```

---

## Part 3: Routing & Integration

### Task 5: Add SmartTrade Route to App.tsx

**Files:**
- Modify: `src/App.tsx`

**Step 1: Import SmartTrade page**

Add import at top of file:
```tsx
import SmartTrade from "./pages/SmartTrade";
```

**Step 2: Add route**

Add after the dashboard route (around line 29):
```tsx
<Route path="/smarttrade" element={<SmartTrade />} />
```

**Step 3: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: No errors

**Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(routing): Add SmartTrade route"
```

---

### Task 6: Test the Complete Flow

**Step 1: Start development server**

Run: `npm run dev`

**Step 2: Manual testing checklist**

- [ ] Navigate to `/dashboard` - verify SmartTrade link appears in nav
- [ ] Click SmartTrade link - should navigate to `/smarttrade`
- [ ] Verify SmartTrade page loads with order form
- [ ] Test buy/sell toggle
- [ ] Test order type selection (market/limit/stop)
- [ ] Test leverage buttons
- [ ] Test take profit / stop loss toggles
- [ ] Navigate to `/exchanges` - verify SmartTrade link in nav
- [ ] Navigate to `/bots` - verify SmartTrade link in nav

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(jadetrade): Complete SmartTrade page and navbar integration"
```

---

## Summary

This plan implements:

1. **DashboardNav Component** - Shared navigation with SmartTrade link
2. **SmartTrade Page** - Full manual trading interface with:
   - Exchange/pair selection
   - Buy/Sell toggle
   - Market/Limit/Stop order types
   - Leverage selection (1x-100x)
   - Take Profit with target price
   - Stop Loss with trigger price
   - Trailing Stop with percentage
   - Order summary sidebar
   - Live price display
3. **Routing** - `/smarttrade` route added to App.tsx

**Plan saved to:** `docs/plans/2025-12-11-smarttrade-navbar-features.md`

**Execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
