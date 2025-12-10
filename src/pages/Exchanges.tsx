import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Link2, Plus, Trash2, Check, X, ExternalLink,
  RefreshCw, Shield, Zap, AlertCircle
} from 'lucide-react';
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

// Exchange definitions with metadata
const EXCHANGES = [
  { 
    id: 'binance', 
    name: 'Binance', 
    logo: '/exchanges/binance.svg',
    color: '#F0B90B',
    types: ['Spot', 'Futures', 'Margin'],
    instruments: ['SmartTrade', 'DCA', 'GRID', 'Signal'],
    createUrl: 'https://www.binance.com/en/my/settings/api-management'
  },
  { 
    id: 'bybit', 
    name: 'Bybit', 
    logo: '/exchanges/bybit.svg',
    color: '#F7A600',
    types: ['Spot', 'Futures'],
    instruments: ['SmartTrade', 'DCA', 'GRID', 'Signal'],
    createUrl: 'https://www.bybit.com/app/user/api-management'
  },
  { 
    id: 'coinbase', 
    name: 'Coinbase', 
    logo: '/exchanges/coinbase.svg',
    color: '#0052FF',
    types: ['Spot'],
    instruments: ['SmartTrade', 'DCA', 'Signal'],
    createUrl: 'https://www.coinbase.com/settings/api'
  },
  { 
    id: 'kraken', 
    name: 'Kraken', 
    logo: '/exchanges/kraken.svg',
    color: '#5741D9',
    types: ['Spot', 'Futures'],
    instruments: ['SmartTrade', 'DCA', 'GRID', 'Signal'],
    createUrl: 'https://pro.kraken.com/app/settings/api'
  },
  { 
    id: 'okx', 
    name: 'OKX', 
    logo: '/exchanges/okx.svg',
    color: '#000000',
    types: ['Spot', 'Futures'],
    instruments: ['SmartTrade', 'DCA', 'GRID', 'Signal'],
    createUrl: 'https://www.okx.com/account/my-api'
  },
  { 
    id: 'kucoin', 
    name: 'KuCoin', 
    logo: '/exchanges/kucoin.svg',
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
  const [keys, setKeys] = useState<ExchangeKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<typeof EXCHANGES[0] | null>(null);
  const [formData, setFormData] = useState({ apiKey: '', apiSecret: '', passphrase: '', label: '' });
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState<string | null>(null);

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

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">My Portfolio</h1>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-6 -mb-px">
            <button className="px-1 py-3 text-sm text-muted-foreground hover:text-foreground border-b-2 border-transparent">
              Overview
            </button>
            <button className="px-1 py-3 text-sm text-foreground font-medium border-b-2 border-primary">
              Exchanges
            </button>
            <button className="px-1 py-3 text-sm text-muted-foreground hover:text-foreground border-b-2 border-transparent">
              Virtual Portfolio
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl bg-gradient-to-r from-teal-900/50 to-cyan-900/50 p-8 mb-8 overflow-hidden"
        >
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2">Exchanges</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Connect all your exchange accounts, manage your trades, and track their profitability.
            </p>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-teal-500 hover:bg-teal-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Connect exchange
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
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
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="font-medium">{selectedExchange.name}</span>
                      <a href={selectedExchange.createUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1">
                        Create API Key <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apiKey">API Key *</Label>
                      <Input id="apiKey" value={formData.apiKey} onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })} placeholder="Enter your API key" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apiSecret">API Secret *</Label>
                      <Input id="apiSecret" type="password" value={formData.apiSecret} onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })} placeholder="Enter your API secret" />
                    </div>
                    {['coinbase', 'kucoin'].includes(selectedExchange.id) && (
                      <div className="space-y-2">
                        <Label htmlFor="passphrase">Passphrase</Label>
                        <Input id="passphrase" type="password" value={formData.passphrase} onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })} placeholder="API passphrase (if required)" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="label">Label</Label>
                      <Input id="label" value={formData.label} onChange={(e) => setFormData({ ...formData, label: e.target.value })} placeholder="e.g., Main Trading Account" />
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
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting ? 'Connecting...' : 'Connect'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-20">
            <Link2 className="w-32 h-32" />
          </div>
        </motion.div>

        {/* Connected Exchanges */}
        {keys.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Connected Exchanges</h3>
            <div className="grid gap-4">
              {keys.map((key) => {
                const exchange = EXCHANGES.find(e => e.id === key.exchange);
                return (
                  <div key={key.id} className="flex items-center justify-between p-4 rounded-xl bg-card border border-border">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg font-bold" style={{ backgroundColor: exchange?.color + '20', color: exchange?.color }}>
                        {exchange?.name.charAt(0) || key.exchange.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{key.label}</p>
                        <p className="text-sm text-muted-foreground">{key.apiKeyMasked}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {key.isValid ? (
                        <Badge variant="outline" className="text-green-500 border-green-500/30">
                          <Check className="w-3 h-3 mr-1" /> Connected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-500 border-red-500/30">
                          <X className="w-3 h-3 mr-1" /> Invalid
                        </Badge>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(key)}>
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-500" />
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
          <h3 className="text-lg font-semibold mb-4">Top exchanges for your country</h3>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-muted-foreground border-b border-border">
                  <th className="px-4 py-3 font-medium">Exchange</th>
                  <th className="px-4 py-3 font-medium">Account types</th>
                  <th className="px-4 py-3 font-medium">Instruments</th>
                  <th className="px-4 py-3 font-medium">Connect existing account</th>
                  <th className="px-4 py-3 font-medium">Create new account</th>
                </tr>
              </thead>
              <tbody>
                {EXCHANGES.map((exchange) => {
                  const connected = getConnectedKey(exchange.id);
                  return (
                    <tr key={exchange.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: exchange.color + '20', color: exchange.color }}>
                            {exchange.name.charAt(0)}
                          </div>
                          <span className="font-medium">{exchange.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">{exchange.types.join(' | ')}</td>
                      <td className="px-4 py-4 text-sm">
                        <div className="flex flex-wrap gap-1">
                          {exchange.instruments.map((inst, i) => (
                            <span key={i} className={`${inst === 'Signal' ? 'text-yellow-500' : 'text-primary'}`}>
                              {inst}{i < exchange.instruments.length - 1 ? ' | ' : ''}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {connected ? (
                          <Badge variant="outline" className="text-green-500 border-green-500/30">
                            <Check className="w-3 h-3 mr-1" /> Connected
                          </Badge>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => handleConnect(exchange)}>
                            <Link2 className="w-3 h-3 mr-1" /> Connect
                          </Button>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <a href={exchange.createUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
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
      </main>
    </div>
  );
};

export default Exchanges;

