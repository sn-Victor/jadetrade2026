import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, AlertCircle,
  Percent, Target, ShieldAlert
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardNav } from '@/components/DashboardNav';
import { PriceTicker } from '@/components/PriceTicker';
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

const SmartTrade = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { priceList } = usePriceDisplay();

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

  const handleSignOut = async () => {
    await signOut();
    toast({ title: 'Signed out successfully' });
    navigate('/');
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
      {/* Left Sidebar Navigation */}
      <DashboardNav onSignOut={handleSignOut} />

      {/* Main Content - offset for sidebar */}
      <div className="ml-64">
        {/* Background gradient effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-emerald-600/8 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 right-0 w-[300px] h-[300px] bg-emerald-400/5 rounded-full blur-[80px]" />
        </div>

        {/* Price Ticker */}
        <PriceTicker />

        <main className="relative z-10 max-w-6xl mx-auto px-6 py-8">
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
    </div>
  );
};

export default SmartTrade;
