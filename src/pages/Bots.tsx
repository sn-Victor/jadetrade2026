import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Hexagon, Bot, ArrowLeft, TrendingUp, 
  Shield, Zap, Crown, Check, Lock 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TradingBot {
  id: string;
  name: string;
  description: string;
  strategy_type: string;
  min_tier: 'free' | 'pro' | 'enterprise';
  monthly_return_avg: number;
  win_rate: number;
  max_drawdown: number;
}

interface UserSubscription {
  bot_id: string;
  is_active: boolean;
}

const tierColors = {
  free: 'bg-green-500/20 text-green-500',
  pro: 'bg-primary/20 text-primary',
  enterprise: 'bg-purple-500/20 text-purple-500',
};

const tierIcons = {
  free: Zap,
  pro: Shield,
  enterprise: Crown,
};

const Bots = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [bots, setBots] = useState<TradingBot[]>([]);
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [userTier] = useState<'free' | 'pro' | 'enterprise'>('free');
  const [loadingBotId, setLoadingBotId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    fetchBots();
    if (user) {
      fetchSubscriptions();
    }
  }, [user]);

  const fetchBots = async () => {
    const { data } = await supabase
      .from('trading_bots')
      .select('*')
      .eq('is_active', true)
      .order('min_tier');

    setBots((data as TradingBot[]) || []);
  };

  const fetchSubscriptions = async () => {
    const { data } = await supabase
      .from('user_bot_subscriptions')
      .select('bot_id, is_active');

    setSubscriptions(data || []);
  };

  const canAccessBot = (botTier: 'free' | 'pro' | 'enterprise') => {
    const tierOrder = { free: 0, pro: 1, enterprise: 2 };
    return tierOrder[userTier] >= tierOrder[botTier];
  };

  const isSubscribed = (botId: string) => {
    return subscriptions.some(s => s.bot_id === botId && s.is_active);
  };

  const handleSubscribe = async (bot: TradingBot) => {
    if (!canAccessBot(bot.min_tier)) {
      toast({
        title: 'Upgrade Required',
        description: `This bot requires a ${bot.min_tier} subscription`,
        variant: 'destructive',
      });
      return;
    }

    setLoadingBotId(bot.id);

    try {
      if (isSubscribed(bot.id)) {
        await supabase
          .from('user_bot_subscriptions')
          .update({ is_active: false })
          .eq('bot_id', bot.id)
          .eq('user_id', user!.id);

        toast({ title: `Unsubscribed from ${bot.name}` });
      } else {
        await supabase
          .from('user_bot_subscriptions')
          .upsert({
            user_id: user!.id,
            bot_id: bot.id,
            is_active: true,
          });

        toast({ title: `Subscribed to ${bot.name}!` });
      }

      fetchSubscriptions();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update subscription',
        variant: 'destructive',
      });
    } finally {
      setLoadingBotId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Hexagon className="w-8 h-8 text-primary fill-primary/20" />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-primary">N</span>
              </div>
              <span className="font-semibold text-lg">Bot Marketplace</span>
            </div>
          </div>

          <Badge className={tierColors[userTier]}>
            {userTier.charAt(0).toUpperCase() + userTier.slice(1)} Plan
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-semibold mb-2">
            Trading <span className="text-gradient">Algorithms</span>
          </h1>
          <p className="text-muted-foreground">
            Subscribe to automated trading strategies powered by our proprietary algorithms
          </p>
        </motion.div>

        {/* Tier Legend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-4 mb-8"
        >
          {(['free', 'pro', 'enterprise'] as const).map((tier) => {
            const Icon = tierIcons[tier];
            return (
              <div key={tier} className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${tier === 'free' ? 'text-green-500' : tier === 'pro' ? 'text-primary' : 'text-purple-500'}`} />
                <span className="text-sm text-muted-foreground capitalize">{tier}</span>
              </div>
            );
          })}
        </motion.div>

        {/* Bots Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bots.map((bot, index) => {
            const TierIcon = tierIcons[bot.min_tier];
            const accessible = canAccessBot(bot.min_tier);
            const subscribed = isSubscribed(bot.id);

            return (
              <motion.div
                key={bot.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                className={`glass rounded-xl p-6 relative ${!accessible ? 'opacity-75' : ''}`}
              >
                {!accessible && (
                  <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] rounded-xl flex items-center justify-center z-10">
                    <div className="text-center">
                      <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Requires {bot.min_tier} plan
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Bot className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{bot.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {bot.strategy_type}
                      </Badge>
                    </div>
                  </div>
                  <Badge className={tierColors[bot.min_tier]}>
                    <TierIcon className="w-3 h-3 mr-1" />
                    {bot.min_tier}
                  </Badge>
                </div>

                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {bot.description}
                </p>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Return</p>
                    <p className="font-semibold text-green-500 font-mono">
                      +{bot.monthly_return_avg}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Win Rate</p>
                    <p className="font-semibold font-mono">{bot.win_rate}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Max DD</p>
                    <p className="font-semibold text-red-500 font-mono">
                      -{bot.max_drawdown}%
                    </p>
                  </div>
                </div>

                <Button
                  className={`w-full ${subscribed ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' : 'button-gradient'}`}
                  onClick={() => handleSubscribe(bot)}
                  disabled={!accessible || loadingBotId === bot.id}
                >
                  {loadingBotId === bot.id ? (
                    'Processing...'
                  ) : subscribed ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Subscribed
                    </>
                  ) : (
                    'Subscribe'
                  )}
                </Button>
              </motion.div>
            );
          })}
        </div>

        {/* Upgrade CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 glass rounded-2xl p-8 text-center"
        >
          <Crown className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">
            Unlock Premium <span className="text-gradient">Algorithms</span>
          </h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            Upgrade to Pro or Enterprise to access our most profitable trading strategies 
            with higher returns and advanced risk management.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
              View Pro Plan - $49/mo
            </Button>
            <Button className="button-gradient">
              View Enterprise - $199/mo
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Bots;