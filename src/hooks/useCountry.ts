import { useState, useEffect } from 'react';

interface CountryInfo {
  code: string;      // ISO 3166-1 alpha-2 (e.g., 'US')
  name: string;      // Full name (e.g., 'United States')
  timezone: string;  // Timezone (e.g., 'America/New_York')
}

// Exchange metadata type
export interface ExchangeMetadata {
  id: string;
  name: string;
  color: string;
  types: string[];
  instruments: string[];
  createUrl: string;
  requiresPassphrase?: boolean;
  comingSoon?: boolean;
  isDex?: boolean;
}

// Full exchange metadata - this is the source of truth
export const EXCHANGES_METADATA: Record<string, ExchangeMetadata> = {
  binance: {
    id: 'binance',
    name: 'Binance',
    color: '#F0B90B',
    types: ['Spot', 'Futures', 'Margin'],
    instruments: ['SmartTrade', 'DCA', 'GRID', 'Signal'],
    createUrl: 'https://www.binance.com/en/my/settings/api-management',
  },
  bingx: {
    id: 'bingx',
    name: 'BingX',
    color: '#2354E6',
    types: ['Spot', 'Futures'],
    instruments: ['SmartTrade', 'DCA', 'GRID', 'Signal'],
    createUrl: 'https://bingx.com/en-us/account/api/',
  },
  bitmex: {
    id: 'bitmex',
    name: 'BitMEX',
    color: '#F7931A',
    types: ['Futures'],
    instruments: ['SmartTrade', 'Signal'],
    createUrl: 'https://www.bitmex.com/app/apiKeys',
  },
  blofin: {
    id: 'blofin',
    name: 'Blofin',
    color: '#00D4AA',
    types: ['Futures'],
    instruments: ['SmartTrade', 'DCA', 'Signal'],
    createUrl: 'https://blofin.com/account/api',
    requiresPassphrase: true,
  },
  bybit: {
    id: 'bybit',
    name: 'Bybit',
    color: '#F7A600',
    types: ['Spot', 'Futures'],
    instruments: ['SmartTrade', 'DCA', 'GRID', 'Signal'],
    createUrl: 'https://www.bybit.com/app/user/api-management',
  },
  coinbase: {
    id: 'coinbase',
    name: 'Coinbase',
    color: '#0052FF',
    types: ['Spot'],
    instruments: ['SmartTrade', 'DCA', 'Signal'],
    createUrl: 'https://www.coinbase.com/settings/api',
  },
  cryptocom: {
    id: 'cryptocom',
    name: 'Crypto.com',
    color: '#002D74',
    types: ['Spot', 'Futures'],
    instruments: ['SmartTrade', 'DCA', 'Signal'],
    createUrl: 'https://crypto.com/exchange/user/settings/api-management',
  },
  deribit: {
    id: 'deribit',
    name: 'Deribit',
    color: '#13B27A',
    types: ['Futures', 'Options'],
    instruments: ['SmartTrade', 'Signal'],
    createUrl: 'https://www.deribit.com/account#/tab-api',
  },
  gateio: {
    id: 'gateio',
    name: 'Gate.io',
    color: '#17E7AA',
    types: ['Spot', 'Futures'],
    instruments: ['SmartTrade', 'DCA', 'GRID', 'Signal'],
    createUrl: 'https://www.gate.io/myaccount/api_key_manage',
  },
  kraken: {
    id: 'kraken',
    name: 'Kraken',
    color: '#5741D9',
    types: ['Spot', 'Futures'],
    instruments: ['SmartTrade', 'DCA', 'GRID', 'Signal'],
    createUrl: 'https://pro.kraken.com/app/settings/api',
  },
  kucoin: {
    id: 'kucoin',
    name: 'KuCoin',
    color: '#23AF91',
    types: ['Spot', 'Futures'],
    instruments: ['SmartTrade', 'DCA', 'GRID', 'Signal'],
    createUrl: 'https://www.kucoin.com/account/api',
    requiresPassphrase: true,
  },
  okx: {
    id: 'okx',
    name: 'OKX',
    color: '#000000',
    types: ['Spot', 'Futures', 'Margin'],
    instruments: ['SmartTrade', 'DCA', 'GRID', 'Signal'],
    createUrl: 'https://www.okx.com/account/my-api',
    requiresPassphrase: true,
  },
  phemex: {
    id: 'phemex',
    name: 'Phemex',
    color: '#0ECB81',
    types: ['Spot', 'Futures'],
    instruments: ['SmartTrade', 'DCA', 'Signal'],
    createUrl: 'https://phemex.com/account/api-keys',
  },
  woo: {
    id: 'woo',
    name: 'WOO X',
    color: '#0C1E32',
    types: ['Spot', 'Futures'],
    instruments: ['SmartTrade', 'DCA', 'Signal'],
    createUrl: 'https://x.woo.org/account/api',
  },
  bitstamp: {
    id: 'bitstamp',
    name: 'Bitstamp',
    color: '#5BB149',
    types: ['Spot'],
    instruments: ['SmartTrade', 'DCA', 'Signal'],
    createUrl: 'https://www.bitstamp.net/account/security/api/',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    color: '#00DCFA',
    types: ['Spot'],
    instruments: ['SmartTrade', 'DCA', 'Signal'],
    createUrl: 'https://exchange.gemini.com/settings/api',
  },
  // Additional CEX exchanges
  thalex: {
    id: 'thalex',
    name: 'Thalex',
    color: '#6366F1',
    types: ['Futures', 'Options'],
    instruments: ['SmartTrade', 'Signal'],
    createUrl: 'https://www.thalex.com/account/api',
    comingSoon: true,
  },
  // DEX Exchanges (Coming Soon - Web3 integration required)
  apex: {
    id: 'apex',
    name: 'Apex Dex',
    color: '#FF6B35',
    types: ['DEX', 'Perpetuals'],
    instruments: ['SmartTrade', 'Signal'],
    createUrl: 'https://www.apex.exchange/',
    comingSoon: true,
    isDex: true,
  },
  bitoro: {
    id: 'bitoro',
    name: 'Bitoro',
    color: '#00C2FF',
    types: ['DEX', 'Perpetuals'],
    instruments: ['SmartTrade', 'Signal'],
    createUrl: 'https://bitoro.network/',
    comingSoon: true,
    isDex: true,
  },
  ibx: {
    id: 'ibx',
    name: 'IBX',
    color: '#7C3AED',
    types: ['DEX'],
    instruments: ['SmartTrade', 'Signal'],
    createUrl: 'https://ibx.trade/',
    comingSoon: true,
    isDex: true,
  },
  logx: {
    id: 'logx',
    name: 'LogX',
    color: '#10B981',
    types: ['DEX', 'Perpetuals'],
    instruments: ['SmartTrade', 'Signal'],
    createUrl: 'https://www.logx.trade/',
    comingSoon: true,
    isDex: true,
  },
  vertex: {
    id: 'vertex',
    name: 'Vertex',
    color: '#EC4899',
    types: ['DEX', 'Perpetuals'],
    instruments: ['SmartTrade', 'DCA', 'Signal'],
    createUrl: 'https://app.vertexprotocol.com/',
    comingSoon: true,
    isDex: true,
  },
  vooi: {
    id: 'vooi',
    name: 'VOOI',
    color: '#F59E0B',
    types: ['DEX', 'Aggregator'],
    instruments: ['SmartTrade', 'Signal'],
    createUrl: 'https://vooi.io/',
    comingSoon: true,
    isDex: true,
  },
  woofipro: {
    id: 'woofipro',
    name: 'WOOFi Pro',
    color: '#0C1E32',
    types: ['DEX', 'Cross-chain'],
    instruments: ['SmartTrade', 'DCA', 'Signal'],
    createUrl: 'https://fi.woo.org/',
    comingSoon: true,
    isDex: true,
  },
};

// Exchange availability and ranking by country/region
export const EXCHANGE_RANKINGS: Record<string, string[]> = {
  // North America
  US: ['coinbase', 'kraken', 'gemini', 'cryptocom', 'bitstamp', 'phemex'],
  CA: ['kraken', 'coinbase', 'binance', 'cryptocom', 'bitstamp', 'bybit'],

  // Europe
  GB: ['kraken', 'coinbase', 'binance', 'bitstamp', 'cryptocom', 'okx'],
  DE: ['kraken', 'binance', 'bitstamp', 'coinbase', 'bybit', 'okx'],
  FR: ['binance', 'kraken', 'coinbase', 'bitstamp', 'bybit', 'okx'],
  NL: ['binance', 'kraken', 'coinbase', 'bitstamp', 'bybit', 'gateio'],
  CH: ['kraken', 'binance', 'coinbase', 'bitstamp', 'bybit', 'deribit'],

  // Asia Pacific
  JP: ['binance', 'kraken', 'bybit', 'okx', 'kucoin', 'gateio'],
  KR: ['binance', 'bybit', 'okx', 'kucoin', 'kraken', 'bingx'],
  SG: ['binance', 'cryptocom', 'gemini', 'kraken', 'bybit', 'okx'],
  AU: ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx'],
  IN: ['binance', 'kucoin', 'okx', 'bybit', 'cryptocom', 'gateio'],

  // Latin America
  BR: ['binance', 'bybit', 'okx', 'kucoin', 'kraken', 'gateio'],
  MX: ['binance', 'coinbase', 'bybit', 'kraken', 'kucoin', 'bitso'],

  // Middle East & Africa
  AE: ['binance', 'cryptocom', 'kraken', 'bybit', 'okx', 'kucoin'],
  NG: ['binance', 'kucoin', 'bybit', 'okx', 'kraken', 'gateio'],

  // Default (global) - all exchanges
  DEFAULT: ['binance', 'bybit', 'okx', 'kucoin', 'gateio', 'bingx', 'coinbase', 'kraken', 'cryptocom', 'phemex', 'bitmex', 'deribit', 'woo', 'blofin'],
};

export function useCountry() {
  const [country, setCountry] = useState<CountryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    detectCountry();
  }, []);

  const detectCountry = async () => {
    try {
      // Method 1: Try browser timezone to guess country
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const browserLocale = navigator.language || 'en-US';
      const localeCountry = browserLocale.split('-')[1]?.toUpperCase();

      // Method 2: Try free IP geolocation API (with timeout)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch('https://ipapi.co/json/', {
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          setCountry({
            code: data.country_code || localeCountry || 'US',
            name: data.country_name || 'Unknown',
            timezone: data.timezone || timezone,
          });
          setLoading(false);
          return;
        }
      } catch (e) {
        // IP API failed, fall back to locale
        console.warn('IP geolocation failed, using browser locale');
      }

      // Fallback: Use browser locale
      const countryFromTimezone = getCountryFromTimezone(timezone);
      setCountry({
        code: localeCountry || countryFromTimezone || 'US',
        name: getCountryName(localeCountry || countryFromTimezone || 'US'),
        timezone,
      });
    } catch (err) {
      setError('Failed to detect country');
      // Default to US
      setCountry({ code: 'US', name: 'United States', timezone: 'America/New_York' });
    } finally {
      setLoading(false);
    }
  };

  // Get ranked exchanges for the detected country
  const getExchangesForCountry = () => {
    const countryCode = country?.code || 'DEFAULT';
    const ranking = EXCHANGE_RANKINGS[countryCode] || EXCHANGE_RANKINGS.DEFAULT;

    // Map to full exchange metadata, filtering out any that don't exist
    return ranking
      .map(id => EXCHANGES_METADATA[id])
      .filter(Boolean);
  };

  return {
    country,
    loading,
    error,
    exchanges: getExchangesForCountry(),
    allExchanges: Object.values(EXCHANGES_METADATA),
  };
}

// Helper: Get country from timezone (common mappings)
function getCountryFromTimezone(timezone: string): string {
  const tzToCountry: Record<string, string> = {
    'America/New_York': 'US',
    'America/Chicago': 'US',
    'America/Denver': 'US',
    'America/Los_Angeles': 'US',
    'America/Toronto': 'CA',
    'America/Vancouver': 'CA',
    'Europe/London': 'GB',
    'Europe/Berlin': 'DE',
    'Europe/Paris': 'FR',
    'Europe/Amsterdam': 'NL',
    'Europe/Zurich': 'CH',
    'Asia/Tokyo': 'JP',
    'Asia/Seoul': 'KR',
    'Asia/Singapore': 'SG',
    'Australia/Sydney': 'AU',
    'Asia/Kolkata': 'IN',
    'America/Sao_Paulo': 'BR',
    'America/Mexico_City': 'MX',
  };

  return tzToCountry[timezone] || 'US';
}

// Helper: Get country name from code
function getCountryName(code: string): string {
  const names: Record<string, string> = {
    US: 'United States',
    CA: 'Canada',
    GB: 'United Kingdom',
    DE: 'Germany',
    FR: 'France',
    NL: 'Netherlands',
    CH: 'Switzerland',
    JP: 'Japan',
    KR: 'South Korea',
    SG: 'Singapore',
    AU: 'Australia',
    IN: 'India',
    BR: 'Brazil',
    MX: 'Mexico',
    AE: 'UAE',
    NG: 'Nigeria',
  };

  return names[code] || code;
}

export default useCountry;
