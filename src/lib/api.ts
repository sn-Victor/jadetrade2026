import { awsConfig } from '@/config/aws';
import { logger } from './logger';

const API_URL = awsConfig.apiGateway.url;

export interface Price {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  marketCap: number;
  image?: string;
  name?: string;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entry_price: number;
  current_price: number;
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
  leverage: number;
  stop_loss?: number;
  take_profit?: number;
  opened_at: string;
  strategy_id?: string;
}

export interface DemoBalance {
  balance: number;
  initialBalance: number;
  positionsValue: number;
  totalValue: number;
  pnl: number;
  pnlPercent: number;
}

export interface ExchangeKey {
  id: string;
  exchange: string;
  label: string;
  apiKeyMasked: string;
  isReadOnly: boolean;
  canTrade: boolean;
  isActive: boolean;
  isValid: boolean;
  lastUsedAt?: string;
  lastValidatedAt?: string;
  createdAt: string;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  tier_required: string;
  symbols: string[];
  win_rate: number;
  avg_profit: number;
  total_trades: number;
  isSubscribed: boolean;
  isLocked: boolean;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) logger.debug('API token set');
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...options.headers,
    };
    logger.debug(`API Request: ${options.method || 'GET'} ${endpoint}`);
    try {
      const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        logger.error(`API Error: ${endpoint}`, error);
        throw new Error(error.error || 'Request failed');
      }
      const data = await response.json();
      logger.debug(`API Response: ${endpoint}`, { status: response.status });
      return data;
    } catch (error) {
      logger.error(`API Exception: ${endpoint}`, error);
      throw error;
    }
  }

  // User
  async getProfile() { return this.request<any>('/api/user'); }
  async updateProfile(data: { full_name?: string }) {
    return this.request<any>('/api/user', { method: 'PUT', body: JSON.stringify(data) });
  }
  async getUserTier() {
    try { return (await this.getProfile())?.subscription_tier || 'free'; }
    catch { return 'free'; }
  }

  // Prices
  async getPrices(): Promise<{ prices: Price[] }> {
    return this.request<{ prices: Price[] }>('/api/prices');
  }

  // Demo Trading
  async getDemoBalance(): Promise<DemoBalance> {
    return this.request<DemoBalance>('/api/trading/balance');
  }
  async getPositions(): Promise<{ positions: Position[] }> {
    return this.request<{ positions: Position[] }>('/api/trading/positions');
  }
  async openPosition(data: { symbol: string; side: 'long' | 'short'; quantity: number; leverage?: number; stopLoss?: number; takeProfit?: number }) {
    logger.trackAction('Open position', data);
    return this.request<{ position: Position }>('/api/trading/positions', { method: 'POST', body: JSON.stringify(data) });
  }
  async closePosition(positionId: string) {
    logger.trackAction('Close position', { positionId });
    return this.request<{ realizedPnl: number; closePrice: number }>('/api/trading/positions/close', { method: 'POST', body: JSON.stringify({ positionId }) });
  }
  async getTradeHistory(): Promise<{ trades: Position[] }> {
    return this.request<{ trades: Position[] }>('/api/trading/history');
  }
  async getTrades() {
    return this.request<{ trades: any[] }>('/api/trading/trades');
  }
  async resetDemoAccount() {
    logger.trackAction('Reset demo account');
    return this.request<{ message: string }>('/api/trading/reset', { method: 'POST' });
  }

  // Strategies
  async getStrategies(): Promise<{ strategies: Strategy[] }> {
    return this.request<{ strategies: Strategy[] }>('/api/strategies');
  }
  async subscribeToStrategy(strategyId: string, autoTrade = false, riskPercent = 1.0) {
    logger.trackAction('Subscribe to strategy', { strategyId, autoTrade });
    return this.request<any>('/api/strategies/subscribe', { method: 'POST', body: JSON.stringify({ strategyId, autoTrade, riskPercent }) });
  }
  async unsubscribeFromStrategy(strategyId: string) {
    logger.trackAction('Unsubscribe from strategy', { strategyId });
    return this.request<any>('/api/strategies/unsubscribe', { method: 'POST', body: JSON.stringify({ strategyId }) });
  }
  async getStrategySubscriptions() {
    return this.request<{ subscriptions: any[] }>('/api/strategies/subscriptions');
  }
  async getSignals(strategyId?: string) {
    const query = strategyId ? `?strategyId=${strategyId}` : '';
    return this.request<{ signals: any[] }>(`/api/strategies/signals${query}`);
  }

  // Legacy bots
  async getBots() { return this.request<any[]>('/api/bots'); }
  async getUserBotSubscriptions() { return this.request<any[]>('/api/bots/subscriptions'); }
  async subscribeToBot(botId: string) { return this.request<any>('/api/bots/subscribe', { method: 'POST', body: JSON.stringify({ botId }) }); }
  async unsubscribeFromBot(botId: string) { return this.request<any>('/api/bots/unsubscribe', { method: 'POST', body: JSON.stringify({ botId }) }); }

  // Portfolios (legacy)
  async getPortfolios() { return this.request<any[]>('/api/portfolios'); }
  async getPortfolioPositions(portfolioId: string) { return this.request<any[]>(`/api/portfolios/${portfolioId}/positions`); }
  async getPortfolioHistory(portfolioId: string) { return this.request<any[]>(`/api/portfolios/${portfolioId}/history`); }

  // Stripe
  async createCheckoutSession(tier: string, successUrl: string, cancelUrl: string) {
    logger.trackAction('Create checkout session', { tier });
    return this.request<{ sessionId: string; url: string }>('/api/stripe/checkout', { method: 'POST', body: JSON.stringify({ tier, successUrl, cancelUrl }) });
  }
  async createPortalSession() {
    logger.trackAction('Create billing portal session');
    return this.request<{ url: string }>('/api/stripe/portal', { method: 'POST' });
  }
  async getPaymentHistory() { return this.request<any[]>('/api/payments'); }
}

// Bot Engine API client (Python FastAPI backend)
const BOT_API_URL = import.meta.env.VITE_BOT_API_URL || 'http://localhost:8000';

class BotEngineClient {
  private getHeaders(): HeadersInit {
    const token = apiClient.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = this.getHeaders();
    logger.debug(`Bot API Request: ${options.method || 'GET'} ${endpoint}`);
    try {
      const response = await fetch(`${BOT_API_URL}${endpoint}`, { ...options, headers });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        logger.error(`Bot API Error: ${endpoint}`, error);
        throw new Error(error.detail || 'Request failed');
      }
      const data = await response.json();
      logger.debug(`Bot API Response: ${endpoint}`, { status: response.status });
      return data;
    } catch (error) {
      logger.error(`Bot API Exception: ${endpoint}`, error);
      throw error;
    }
  }

  // Health check
  async health() {
    return this.request<{ status: string; timestamp: string }>('/health');
  }

  // Live positions (from exchange)
  async getLivePositions() {
    return this.request<{ positions: Position[] }>('/api/positions');
  }

  // Live trades history
  async getLiveTrades(limit = 50) {
    return this.request<{ trades: any[] }>(`/api/trades?limit=${limit}`);
  }

  // Exchange API keys
  async getExchangeKeys() {
    return this.request<{ keys: ExchangeKey[] }>('/api/exchange-keys');
  }

  async addExchangeKey(data: { exchange: string; apiKey: string; apiSecret: string; passphrase?: string; label?: string }) {
    logger.trackAction('Add exchange API key', { exchange: data.exchange });
    return this.request<{ message: string; key: { id: string; exchange: string; label: string } }>(
      '/api/exchange-keys',
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  async deleteExchangeKey(keyId: string) {
    logger.trackAction('Delete exchange API key', { keyId });
    return this.request<{ message: string }>(`/api/exchange-keys/${keyId}`, { method: 'DELETE' });
  }

  async updateExchangeKey(keyId: string, data: { isActive?: boolean; label?: string }) {
    logger.trackAction('Update exchange API key', { keyId, ...data });
    return this.request<{ key: ExchangeKey }>(`/api/exchange-keys/${keyId}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async validateExchangeKey(keyId: string) {
    logger.trackAction('Validate exchange API key', { keyId });
    return this.request<{ valid: boolean; balance?: number; error?: string }>(`/api/exchange-keys/${keyId}/validate`, { method: 'POST' });
  }

  // Manual trade execution
  async executeTrade(data: { symbol: string; side: 'buy' | 'sell'; quantity: number; exchange?: string }) {
    logger.trackAction('Execute live trade', data);
    return this.request<{ trade_id: string; status: string }>('/api/trades/execute', { method: 'POST', body: JSON.stringify(data) });
  }

  // Close position
  async closePosition(positionId: string) {
    logger.trackAction('Close live position', { positionId });
    return this.request<{ success: boolean }>(`/api/positions/${positionId}/close`, { method: 'POST' });
  }
}

export const botEngineClient = new BotEngineClient();
export const apiClient = new ApiClient();