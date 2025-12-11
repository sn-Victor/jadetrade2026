import { useState, useEffect, useCallback } from 'react';

// CoinGecko API (free tier: 10-30 calls/min)
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Coin IDs for CoinGecko API
const COIN_IDS = [
  'bitcoin',
  'ethereum',
  'solana',
  'binancecoin',
  'ripple',
  'cardano',
  'dogecoin',
  'polkadot',
  'avalanche-2',
  'chainlink',
  'polygon',
  'uniswap',
];

const COIN_SYMBOLS: Record<string, string> = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  solana: 'SOL',
  binancecoin: 'BNB',
  ripple: 'XRP',
  cardano: 'ADA',
  dogecoin: 'DOGE',
  polkadot: 'DOT',
  'avalanche-2': 'AVAX',
  chainlink: 'LINK',
  polygon: 'MATIC',
  uniswap: 'UNI',
};

export interface CoinPrice {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  lastUpdated: Date;
}

interface UsePricesOptions {
  refreshInterval?: number; // in milliseconds, default 30s
  currency?: string; // default 'usd'
}

interface UsePricesReturn {
  prices: CoinPrice[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

// Fallback mock data if API fails - initialize with this
function getMockPrices(): CoinPrice[] {
  return [
    { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', price: 97234.52, change24h: 2.31, marketCap: 1920000000000, volume24h: 45000000000, lastUpdated: new Date() },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', price: 3892.16, change24h: -1.17, marketCap: 468000000000, volume24h: 18000000000, lastUpdated: new Date() },
    { id: 'solana', symbol: 'SOL', name: 'Solana', price: 224.87, change24h: 5.42, marketCap: 106000000000, volume24h: 5600000000, lastUpdated: new Date() },
    { id: 'binancecoin', symbol: 'BNB', name: 'BNB', price: 712.34, change24h: 1.08, marketCap: 103000000000, volume24h: 1800000000, lastUpdated: new Date() },
    { id: 'ripple', symbol: 'XRP', name: 'XRP', price: 2.34, change24h: 3.21, marketCap: 134000000000, volume24h: 12000000000, lastUpdated: new Date() },
    { id: 'cardano', symbol: 'ADA', name: 'Cardano', price: 1.12, change24h: -0.84, marketCap: 39000000000, volume24h: 1200000000, lastUpdated: new Date() },
    { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', price: 0.42, change24h: 8.45, marketCap: 62000000000, volume24h: 4500000000, lastUpdated: new Date() },
    { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', price: 9.87, change24h: 2.15, marketCap: 15000000000, volume24h: 450000000, lastUpdated: new Date() },
    { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche', price: 45.23, change24h: 4.12, marketCap: 18000000000, volume24h: 890000000, lastUpdated: new Date() },
    { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', price: 24.56, change24h: 1.89, marketCap: 14000000000, volume24h: 650000000, lastUpdated: new Date() },
    { id: 'polygon', symbol: 'MATIC', name: 'Polygon', price: 0.98, change24h: -2.34, marketCap: 9000000000, volume24h: 420000000, lastUpdated: new Date() },
    { id: 'uniswap', symbol: 'UNI', name: 'Uniswap', price: 14.32, change24h: 3.67, marketCap: 10000000000, volume24h: 310000000, lastUpdated: new Date() },
  ];
}

export function usePrices(options: UsePricesOptions = {}): UsePricesReturn {
  const { refreshInterval = 30000, currency = 'usd' } = options;

  // Start with mock data so UI is never empty
  const [prices, setPrices] = useState<CoinPrice[]>(getMockPrices());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      const ids = COIN_IDS.join(',');
      const url = `${COINGECKO_API}/coins/markets?vs_currency=${currency}&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`;

      const response = await fetch(url);

      if (!response.ok) {
        // CoinGecko rate limit - keep using current data
        if (response.status === 429) {
          console.warn('CoinGecko rate limit hit, using cached data');
          setLoading(false);
          return;
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      const formattedPrices: CoinPrice[] = data.map((coin: any) => ({
        id: coin.id,
        symbol: COIN_SYMBOLS[coin.id] || coin.symbol.toUpperCase(),
        name: coin.name,
        price: coin.current_price || 0,
        change24h: coin.price_change_percentage_24h || 0,
        marketCap: coin.market_cap || 0,
        volume24h: coin.total_volume || 0,
        lastUpdated: new Date(coin.last_updated || Date.now()),
      }));

      setPrices(formattedPrices);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to fetch prices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
      // Keep existing prices (mock or previous real data)
    } finally {
      setLoading(false);
    }
  }, [currency]);

  // Initial fetch
  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(fetchPrices, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPrices, refreshInterval]);

  return {
    prices,
    loading,
    error,
    lastUpdated,
    refresh: fetchPrices,
  };
}

// Simple hook for just price display (formatted for UI)
export function usePriceDisplay() {
  const { prices, loading, error, lastUpdated } = usePrices({ refreshInterval: 30000 });

  const priceMap = prices.reduce((acc, coin) => {
    acc[coin.id] = {
      symbol: `${coin.symbol}/USD`,
      price: coin.price,
      change: coin.change24h,
      volume: coin.volume24h,
    };
    return acc;
  }, {} as Record<string, { symbol: string; price: number; change: number; volume: number }>);

  // Sort by volume (highest first) by default
  const sortedByVolume = [...prices].sort((a, b) => b.volume24h - a.volume24h);

  return {
    prices: priceMap,
    priceList: sortedByVolume.map(p => ({
      id: p.id,
      symbol: `${p.symbol}/USD`,
      price: p.price,
      change: p.change24h,
      volume: p.volume24h,
    })),
    loading,
    error,
    lastUpdated,
  };
}

export default usePrices;
