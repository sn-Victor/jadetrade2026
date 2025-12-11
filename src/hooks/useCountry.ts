import { useState, useEffect } from 'react';

interface CountryInfo {
  code: string;      // ISO 3166-1 alpha-2 (e.g., 'US')
  name: string;      // Full name (e.g., 'United States')
  timezone: string;  // Timezone (e.g., 'America/New_York')
}

// Full exchange metadata - this is the source of truth
export const EXCHANGES_METADATA: Record<string, {
  id: string;
  name: string;
  color: string;
  types: string[];
  instruments: string[];
  createUrl: string;
}> = {
  binance: {
    id: 'binance',
    name: 'Binance',
    color: '#F0B90B',
    types: ['Spot', 'Futures', 'Margin'],
    instruments: ['SmartTrade', 'DCA', 'GRID', 'Signal'],
    createUrl: 'https://www.binance.com/en/my/settings/api-management',
  },
  coinbase: {
    id: 'coinbase',
    name: 'Coinbase',
    color: '#0052FF',
    types: ['Spot'],
    instruments: ['SmartTrade', 'DCA', 'Signal'],
    createUrl: 'https://www.coinbase.com/settings/api',
  },
  kraken: {
    id: 'kraken',
    name: 'Kraken',
    color: '#5741D9',
    types: ['Spot', 'Futures'],
    instruments: ['SmartTrade', 'DCA', 'GRID', 'Signal'],
    createUrl: 'https://pro.kraken.com/app/settings/api',
  },
  bybit: {
    id: 'bybit',
    name: 'Bybit',
    color: '#F7A600',
    types: ['Spot', 'Futures'],
    instruments: ['SmartTrade', 'DCA', 'GRID', 'Signal'],
    createUrl: 'https://www.bybit.com/app/user/api-management',
  },
  okx: {
    id: 'okx',
    name: 'OKX',
    color: '#121212',
    types: ['Spot', 'Futures'],
    instruments: ['SmartTrade', 'DCA', 'GRID', 'Signal'],
    createUrl: 'https://www.okx.com/account/my-api',
  },
  kucoin: {
    id: 'kucoin',
    name: 'KuCoin',
    color: '#23AF91',
    types: ['Spot'],
    instruments: ['SmartTrade', 'DCA', 'GRID', 'Signal'],
    createUrl: 'https://www.kucoin.com/account/api',
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
  crypto_com: {
    id: 'crypto_com',
    name: 'Crypto.com',
    color: '#002D74',
    types: ['Spot'],
    instruments: ['SmartTrade', 'DCA', 'Signal'],
    createUrl: 'https://crypto.com/exchange/user/settings/api-management',
  },
};

// Exchange availability and ranking by country/region
export const EXCHANGE_RANKINGS: Record<string, string[]> = {
  // North America
  US: ['coinbase', 'kraken', 'gemini', 'crypto_com', 'bitstamp'],
  CA: ['kraken', 'coinbase', 'binance', 'crypto_com', 'bitstamp'],

  // Europe
  GB: ['kraken', 'coinbase', 'binance', 'bitstamp', 'crypto_com'],
  DE: ['kraken', 'binance', 'bitstamp', 'coinbase', 'bybit'],
  FR: ['binance', 'kraken', 'coinbase', 'bitstamp', 'bybit'],
  NL: ['binance', 'kraken', 'coinbase', 'bitstamp', 'bybit'],
  CH: ['kraken', 'binance', 'coinbase', 'bitstamp', 'bybit'],

  // Asia Pacific
  JP: ['binance', 'kraken', 'bybit', 'okx', 'kucoin'],
  KR: ['binance', 'bybit', 'okx', 'kucoin', 'kraken'],
  SG: ['binance', 'crypto_com', 'gemini', 'kraken', 'bybit'],
  AU: ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin'],
  IN: ['binance', 'kucoin', 'okx', 'bybit', 'crypto_com'],

  // Latin America
  BR: ['binance', 'bybit', 'okx', 'kucoin', 'kraken'],
  MX: ['binance', 'coinbase', 'bybit', 'kraken', 'kucoin'],

  // Middle East & Africa
  AE: ['binance', 'crypto_com', 'kraken', 'bybit', 'okx'],
  NG: ['binance', 'kucoin', 'bybit', 'okx', 'kraken'],

  // Default (global)
  DEFAULT: ['binance', 'coinbase', 'kraken', 'bybit', 'okx', 'kucoin'],
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
