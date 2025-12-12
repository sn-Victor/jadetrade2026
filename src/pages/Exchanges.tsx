import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Link2, Plus, Trash2, Check, X, ExternalLink,
  Shield, TrendingUp, MapPin
} from 'lucide-react';
import { DashboardNav } from '@/components/DashboardNav';
import { PriceTicker } from '@/components/PriceTicker';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { apiClient, ExchangeKey } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { useCountry, EXCHANGES_METADATA } from '@/hooks/useCountry';

// Exchange definitions with metadata
const EXCHANGES = [
  {
    id: 'binance',
    name: 'Binance',
    color: '#F0B90B',
    types: ['Spot', 'Futures', 'Margin'],
    instruments: ['SmartTrade', 'DCA', 'GRID', 'Signal'],
    createUrl: 'https://www.binance.com/en/my/settings/api-management'
  },
  {
    id: 'bybit',
    name: 'Bybit',
    color: '#F7A600',
    types: ['Spot', 'Futures'],
    instruments: ['SmartTrade', 'DCA', 'GRID', 'Signal'],
    createUrl: 'https://www.bybit.com/app/user/api-management'
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    color: '#0052FF',
    types: ['Spot'],
    instruments: ['SmartTrade', 'DCA', 'Signal'],
    createUrl: 'https://www.coinbase.com/settings/api'
  },
  {
    id: 'kraken',
    name: 'Kraken',
    color: '#5741D9',
    types: ['Spot', 'Futures'],
    instruments: ['SmartTrade', 'DCA', 'GRID', 'Signal'],
    createUrl: 'https://pro.kraken.com/app/settings/api'
  },
  {
    id: 'okx',
    name: 'OKX',
    color: '#121212',
    types: ['Spot', 'Futures'],
    instruments: ['SmartTrade', 'DCA', 'GRID', 'Signal'],
    createUrl: 'https://www.okx.com/account/my-api'
  },
  {
    id: 'kucoin',
    name: 'KuCoin',
    color: '#23AF91',
    types: ['Spot'],
    instruments: ['SmartTrade', 'DCA', 'GRID', 'Signal'],
    createUrl: 'https://www.kucoin.com/account/api'
  },
];

const Exchanges = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { country, exchanges: rankedExchanges, loading: countryLoading } = useCountry();
  const [keys, setKeys] = useState<ExchangeKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<typeof EXCHANGES[0] | null>(null);
  const [formData, setFormData] = useState({ apiKey: '', apiSecret: '', passphrase: '', label: '' });
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'exchanges' | 'virtual'>('exchanges');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchKeys();
    }
  }, [user]);

  const fetchKeys = async () => {
    try {
      const response = await apiClient.getExchangeKeys();
      setKeys(response.keys || []);
    } catch (error) {
      console.error('Failed to fetch exchange keys:', error);
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleConnect = (exchange: typeof EXCHANGES[0]) => {
    setSelectedExchange(exchange);
    setFormData({ apiKey: '', apiSecret: '', passphrase: '', label: `${exchange.name} Account` });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedExchange || !formData.apiKey || !formData.apiSecret) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.addExchangeKey({
        exchange: selectedExchange.id,
        apiKey: formData.apiKey,
        apiSecret: formData.apiSecret,
        passphrase: formData.passphrase || undefined,
        label: formData.label || `${selectedExchange.name} Account`,
      });
      toast({ title: 'Success', description: `${selectedExchange.name} connected successfully!` });
      setDialogOpen(false);
      fetchKeys();
      logger.trackAction('Exchange connected', { exchange: selectedExchange.id });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to connect exchange', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (key: ExchangeKey) => {
    if (!confirm(`Are you sure you want to disconnect ${key.label}?`)) return;
    try {
      await apiClient.deleteExchangeKey(key.id);
      toast({ title: 'Disconnected', description: `${key.label} has been removed` });
      fetchKeys();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const getConnectedKey = (exchangeId: string) => keys.find(k => k.exchange === exchangeId);

  // Use ranked exchanges based on country, fallback to default EXCHANGES
  const displayExchanges = rankedExchanges.length > 0 ? rankedExchanges : EXCHANGES;

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
      <DashboardNav />

      {/* Main Content - offset for sidebar */}
      <div className="ml-64">
        {/* Background gradient effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-emerald-600/8 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 right-0 w-[300px] h-[300px] bg-emerald-400/5 rounded-full blur-[80px]" />
        </div>

      {/* Price Ticker Bar with Search */}
      <PriceTicker />

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Page Header with Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">My Portfolio</h1>
          <p className="text-muted-foreground mb-6">
            Manage your exchange connections and track your portfolio performance.
          </p>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'overview'
                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('exchanges')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'exchanges'
                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent'
              }`}
            >
              Exchanges
            </button>
            <button
              onClick={() => setActiveTab('virtual')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'virtual'
                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent'
              }`}
            >
              Virtual Portfolio
            </button>
          </div>
        </motion.div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Portfolio Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-6">
                <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
                <p className="text-2xl font-bold text-emerald-400">$0.00</p>
                <p className="text-xs text-muted-foreground mt-1">Connect an exchange to see balance</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-6">
                <p className="text-sm text-muted-foreground mb-1">Active Bots</p>
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground mt-1">No bots running</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-6">
                <p className="text-sm text-muted-foreground mb-1">Connected Exchanges</p>
                <p className="text-2xl font-bold">{keys.length}</p>
                <p className="text-xs text-muted-foreground mt-1">{keys.length === 0 ? 'No exchanges connected' : `${keys.length} exchange(s) connected`}</p>
              </div>
            </div>

            {/* Empty state or portfolio chart would go here */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <Link2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Connect your first exchange</h3>
              <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">
                Link your exchange account to see your portfolio balance, track performance, and start automated trading.
              </p>
              <Button
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
                onClick={() => setActiveTab('exchanges')}
              >
                Go to Exchanges
              </Button>
            </div>
          </motion.div>
        )}

        {/* Exchanges Tab */}
        {activeTab === 'exchanges' && (
          <>
            {/* Hero Banner */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent border border-emerald-500/20 p-8 mb-6 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10">
                <h2 className="text-2xl font-bold mb-2">Exchanges</h2>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Connect all your exchange accounts, manage your trades, and track their profitability.
                </p>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold">
                      <Plus className="w-4 h-4 mr-2" />
                      Connect exchange
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md bg-[#0a0f0d] border-white/10">
                    <DialogHeader>
                      <DialogTitle>
                        {selectedExchange ? `Connect ${selectedExchange.name}` : 'Connect Exchange'}
                      </DialogTitle>
                      <DialogDescription>
                        Enter your API credentials. We only need read and trade permissions - never withdrawal.
                      </DialogDescription>
                    </DialogHeader>
                    {selectedExchange && (
                      <div className="space-y-4 py-4">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                          <span className="font-medium">{selectedExchange.name}</span>
                          <a href={selectedExchange.createUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-400 flex items-center gap-1 hover:underline">
                            Create API Key <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="apiKey">API Key *</Label>
                          <Input id="apiKey" value={formData.apiKey} onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })} placeholder="Enter your API key" className="bg-white/5 border-white/10" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="apiSecret">API Secret *</Label>
                          <Input id="apiSecret" type="password" value={formData.apiSecret} onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })} placeholder="Enter your API secret" className="bg-white/5 border-white/10" />
                        </div>
                        {['coinbase', 'kucoin'].includes(selectedExchange.id) && (
                          <div className="space-y-2">
                            <Label htmlFor="passphrase">Passphrase</Label>
                            <Input id="passphrase" type="password" value={formData.passphrase} onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })} placeholder="API passphrase (if required)" className="bg-white/5 border-white/10" />
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label htmlFor="label">Label</Label>
                          <Input id="label" value={formData.label} onChange={(e) => setFormData({ ...formData, label: e.target.value })} placeholder="e.g., Main Trading Account" className="bg-white/5 border-white/10" />
                        </div>
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                          <Shield className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-yellow-500/90">
                            Your API keys are encrypted with AES-256-GCM and stored securely. Never enable withdrawal permissions.
                          </p>
                        </div>
                      </div>
                    )}
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-white/10 hover:bg-white/5">Cancel</Button>
                      <Button onClick={handleSubmit} disabled={submitting} className="bg-emerald-500 hover:bg-emerald-600 text-black">
                        {submitting ? 'Connecting...' : 'Connect'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10">
                <Link2 className="w-32 h-32 text-emerald-400" />
              </div>
            </motion.div>

            {/* Kraken Recommendation Banner */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-2xl bg-white/[0.02] backdrop-blur-sm border border-white/10 p-6 mb-6 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#5741D9] flex items-center justify-center">
                  <span className="text-white font-bold text-xl">K</span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Don't have an exchange yet?</h3>
                  <p className="text-sm text-muted-foreground">
                    We recommend our trusted partner Kraken. Start trading immediately after verification.
                  </p>
                </div>
              </div>
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold">
                Create Kraken account
              </Button>
            </motion.div>

            {/* Connected Exchanges */}
            {keys.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Connected Exchanges</h3>
                <div className="grid gap-4">
                  {keys.map((key) => {
                    const exchange = EXCHANGES.find(e => e.id === key.exchange);
                    return (
                      <div key={key.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] backdrop-blur-sm border border-white/10 hover:border-emerald-500/20 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold" style={{ backgroundColor: exchange?.color + '20', color: exchange?.color }}>
                            {exchange?.name.charAt(0) || key.exchange.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{key.label}</p>
                            <p className="text-sm text-muted-foreground">{key.apiKeyMasked}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {key.isValid ? (
                            <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                              <Check className="w-3 h-3 mr-1" /> Connected
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-400 border-red-500/30 bg-red-500/10">
                              <X className="w-3 h-3 mr-1" /> Invalid
                            </Badge>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(key)} className="hover:bg-red-500/10 hover:text-red-400">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Exchange List */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-semibold">Top exchanges for</h3>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-400">
                    {countryLoading ? 'Detecting...' : country?.name || 'Global'}
                  </span>
                </div>
              </div>
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
                    {displayExchanges.map((exchange) => {
                      const connected = getConnectedKey(exchange.id);
                      return (
                        <tr key={exchange.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style={{ backgroundColor: exchange.color + '20', color: exchange.color }}>
                                {exchange.name.charAt(0)}
                              </div>
                              <span className="font-medium">{exchange.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm text-muted-foreground">{exchange.types.join(' | ')}</td>
                          <td className="px-5 py-4 text-sm">
                            {exchange.instruments.map((inst, i) => (
                              <span key={inst}>
                                <span className={inst === 'Signal' ? 'text-yellow-400' : 'text-emerald-400'}>{inst}</span>
                                {i < exchange.instruments.length - 1 && <span className="text-muted-foreground"> | </span>}
                              </span>
                            ))}
                          </td>
                          <td className="px-5 py-4">
                            {connected ? (
                              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                                <Check className="w-3 h-3 mr-1" /> Connected
                              </Badge>
                            ) : (
                              <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50" onClick={() => handleConnect(exchange as any)}>
                                <Link2 className="w-3 h-3 mr-1" /> Connect
                              </Button>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <a href={exchange.createUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-emerald-400 transition-colors flex items-center gap-1">
                              + Create
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </>
        )}

        {/* Virtual Portfolio Tab */}
        {activeTab === 'virtual' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Virtual Portfolio</h3>
              <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">
                Practice trading with virtual funds before risking real money. Test your strategies in a risk-free environment.
              </p>
              <Button
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
              >
                Create Virtual Portfolio
              </Button>
            </div>
          </motion.div>
        )}
      </main>
      </div>
    </div>
  );
};

export default Exchanges;
