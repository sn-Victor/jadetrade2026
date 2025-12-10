import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Copy, ExternalLink, Info, ChevronDown,
  Webhook, Grid3X3, DollarSign, AlertCircle, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const ALERT_TYPES = [
  { id: 'custom', name: 'Custom Signal', description: 'Different types of signals from any sources.', icon: Webhook },
  { id: 'tradingview', name: 'TradingView Strategy', description: 'Automate trading rules with Pine Script', icon: Grid3X3 },
];

const DIRECTIONS = ['Long', 'Reversal', 'Short'];

const CreateBot = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const botType = searchParams.get('type') || 'signal';

  // Form state
  const [name, setName] = useState('Demo Signal Bot');
  const [alertType, setAlertType] = useState<'custom' | 'tradingview'>('custom');
  const [direction, setDirection] = useState('Long');
  const [maxInvestment, setMaxInvestment] = useState('100');
  const [investmentType, setInvestmentType] = useState<'percent' | 'fixed'>('percent');
  const [volumePerOrder, setVolumePerOrder] = useState('100');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');

  // Order settings
  const [entryOrders, setEntryOrders] = useState(true);
  const [exitOrders, setExitOrders] = useState(false);
  const [takeProfit, setTakeProfit] = useState(false);
  const [stopLoss, setStopLoss] = useState(false);

  // Generated webhook data
  const [webhookUrl] = useState('https://api.jadetrade.io/webhooks/tradingview');
  const [webhookSecret] = useState(() => {
    // Generate a random webhook secret
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 64 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied to clipboard` });
  };

  const webhookMessage = JSON.stringify({
    secret: webhookSecret.substring(0, 50) + '...',
    action: '{{strategy.order.action}}',
    symbol: '{{ticker}}',
    price: '{{close}}',
    strategy_id: 'YOUR_STRATEGY_ID',
  }, null, 2);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const getBotIcon = () => {
    switch (botType) {
      case 'dca': return DollarSign;
      case 'grid': return Grid3X3;
      default: return Webhook;
    }
  };

  const getBotTitle = () => {
    switch (botType) {
      case 'dca': return 'Create DCA Bot';
      case 'grid': return 'Create GRID Bot';
      default: return 'Create Signal Bot';
    }
  };

  const BotIcon = getBotIcon();

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Header */}
      <header className="border-b border-border/50 bg-[#161b22]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="h-14 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#21262d] flex items-center justify-center">
                  <BotIcon className="w-4 h-4 text-cyan-400" />
                </div>
                <h1 className="text-lg font-semibold">{getBotTitle()}</h1>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-border/50"
            >
              <Info className="w-4 h-4 mr-2" />
              Guide
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border/50 bg-[#161b22] p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Main</h2>
                <button className="text-sm text-cyan-400 hover:text-cyan-300">Video tutorial</button>
              </div>

              {/* Alert Type */}
              <div className="mb-6">
                <Label className="text-muted-foreground mb-3 block">Alert type</Label>
                <div className="grid grid-cols-2 gap-3">
                  {ALERT_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setAlertType(type.id as 'custom' | 'tradingview')}
                      className={`p-4 rounded-lg border text-left transition-colors ${
                        alertType === type.id
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-border/50 bg-[#21262d] hover:border-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <type.icon className={`w-5 h-5 ${alertType === type.id ? 'text-cyan-400' : 'text-muted-foreground'}`} />
                        <div>
                          <div className="font-medium">{type.name}</div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name & Exchange Row */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <Label className="text-muted-foreground mb-2 block">Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-[#21262d] border-border/50"
                    placeholder="Bot name"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground mb-2 block">Exchange</Label>
                  <Button
                    variant="outline"
                    className="w-full justify-between border-border/50 bg-[#21262d]"
                    onClick={() => navigate('/exchanges')}
                  >
                    <span className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                      Not connected
                    </span>
                    <span className="text-cyan-400">+Connect</span>
                  </Button>
                </div>
              </div>

              {/* Direction & Pairs Row */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <Label className="text-muted-foreground mb-2 block">Direction</Label>
                  <div className="flex rounded-lg bg-[#21262d] p-1">
                    {DIRECTIONS.map((dir) => (
                      <button
                        key={dir}
                        onClick={() => setDirection(dir)}
                        className={`flex-1 py-2 px-3 text-sm rounded-md transition-colors ${
                          direction === dir
                            ? 'bg-[#0d1117] text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {dir}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground mb-2 block">Pairs</Label>
                  <Button
                    variant="outline"
                    className="w-full justify-between border-border/50 bg-[#21262d]"
                  >
                    Select pairs
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Max Investment */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Label className="text-muted-foreground">Max. investment usage</Label>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={maxInvestment}
                    onChange={(e) => setMaxInvestment(e.target.value)}
                    className="bg-[#21262d] border-border/50 w-32"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border/50 bg-[#21262d]"
                  >
                    % per Bot
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* Set Signal Alerts Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl border border-border/50 bg-[#161b22] p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Set signal alerts</h2>
                <button className="text-sm text-cyan-400 hover:text-cyan-300">Video tutorial</button>
              </div>

              <div className="mb-4">
                <Label className="text-cyan-400 mb-2 block">Webhook URL for TradingView or other sources</Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      value={webhookUrl}
                      readOnly
                      className="bg-[#21262d] border-border/50 pr-10"
                    />
                    <button
                      onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <Button variant="outline" className="border-border/50 bg-[#21262d]">
                    Go to TradingView
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Copy and paste the Webhook URL into your Alert notifications tab on TradingView or other sources
                </p>
              </div>
            </motion.div>

            {/* Order Settings Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl border border-border/50 bg-[#161b22] p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Order settings</h2>
                <button className="text-sm text-cyan-400 hover:text-cyan-300">Video tutorial</button>
              </div>

              {/* Entry Orders Toggle */}
              <div className="flex items-center justify-between py-3 border-l-2 border-cyan-500 pl-4 mb-4">
                <span className="font-medium">Entry orders</span>
                <Switch
                  checked={entryOrders}
                  onCheckedChange={setEntryOrders}
                />
              </div>

              {entryOrders && (
                <div className="ml-4 space-y-4 mb-6">
                  {/* Volume & Order Type */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground mb-2 block">Volume per order</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={volumePerOrder}
                          onChange={(e) => setVolumePerOrder(e.target.value)}
                          className="bg-[#21262d] border-border/50"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-border/50 bg-[#21262d] whitespace-nowrap"
                        >
                          Total investment, %
                          <ChevronDown className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground mb-2 block">Order type</Label>
                      <div className="flex rounded-lg bg-[#21262d] p-1">
                        <button
                          onClick={() => setOrderType('market')}
                          className={`flex-1 py-2 px-4 text-sm rounded-md transition-colors ${
                            orderType === 'market'
                              ? 'bg-[#0d1117] text-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Market
                        </button>
                        <button
                          onClick={() => setOrderType('limit')}
                          className={`flex-1 py-2 px-4 text-sm rounded-md transition-colors ${
                            orderType === 'limit'
                              ? 'bg-[#0d1117] text-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Limit
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Webhook Message */}
                  <div>
                    <Label className="text-cyan-400 mb-2 block">Webhook message for entry order signals</Label>
                    <div className="relative">
                      <pre className="bg-[#21262d] border border-border/50 rounded-lg p-4 text-xs text-muted-foreground overflow-x-auto">
                        {webhookMessage}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(webhookMessage, 'Webhook message')}
                        className="absolute top-2 right-2 p-2 rounded bg-[#0d1117] text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Copy and paste the JSON code to alert settings
                    </p>
                  </div>
                </div>
              )}

              {/* Exit Orders Toggle */}
              <div className="flex items-center justify-between py-3 border-l-2 border-border/30 pl-4 mb-2">
                <span className="text-muted-foreground">Exit orders</span>
                <Switch
                  checked={exitOrders}
                  onCheckedChange={setExitOrders}
                />
              </div>

              {/* Take Profit Toggle */}
              <div className="flex items-center justify-between py-3 border-l-2 border-border/30 pl-4 mb-2">
                <span className="text-muted-foreground">Take profit</span>
                <Switch
                  checked={takeProfit}
                  onCheckedChange={setTakeProfit}
                />
              </div>

              {/* Stop Loss Toggle */}
              <div className="flex items-center justify-between py-3 border-l-2 border-border/30 pl-4">
                <span className="text-muted-foreground">Stop Loss</span>
                <Switch
                  checked={stopLoss}
                  onCheckedChange={setStopLoss}
                />
              </div>
            </motion.div>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-xl border border-border/50 bg-[#161b22] p-6 sticky top-6"
            >
              <h3 className="text-lg font-semibold mb-4">Summary</h3>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Max. total investment</span>
                  <span className="text-cyan-400">0</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Trade start condition:</span>
                  <span className="text-cyan-400">Custom signal</span>
                </div>
              </div>

              <div className="border border-dashed border-yellow-500/50 rounded-lg p-4 mb-6 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">
                  Connect an exchange to start trading
                </span>
              </div>

              <Button
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-medium"
                size="lg"
                onClick={() => navigate('/exchanges')}
              >
                Connect an exchange
              </Button>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CreateBot;
