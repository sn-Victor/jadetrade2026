import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'jadetrade_ticker_preferences';

export interface TickerPreference {
  id: string;        // coin id (e.g., 'bitcoin')
  symbol: string;    // display symbol (e.g., 'BTC/USD')
  visible: boolean;  // whether to show in ticker
  order: number;     // display order
}

interface TickerPreferences {
  tickers: TickerPreference[];
  sortBy: 'custom' | 'volume' | 'change' | 'price';
  lastUpdated: string;
}

const DEFAULT_VISIBLE = ['bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple', 'dogecoin'];

export function useTickerPreferences() {
  const [preferences, setPreferences] = useState<TickerPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as TickerPreferences;
        setPreferences(parsed);
      }
    } catch (e) {
      console.error('Failed to load ticker preferences:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save preferences to localStorage
  const savePreferences = useCallback((prefs: TickerPreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      setPreferences(prefs);
    } catch (e) {
      console.error('Failed to save ticker preferences:', e);
    }
  }, []);

  // Initialize preferences with default coins if not set
  const initializeWithPrices = useCallback((priceList: Array<{ id: string; symbol: string; volume: number }>) => {
    if (preferences) return; // Already initialized

    const tickers: TickerPreference[] = priceList.map((p, index) => ({
      id: p.id,
      symbol: p.symbol,
      visible: DEFAULT_VISIBLE.includes(p.id),
      order: DEFAULT_VISIBLE.includes(p.id) ? DEFAULT_VISIBLE.indexOf(p.id) : 100 + index,
    }));

    const newPrefs: TickerPreferences = {
      tickers: tickers.sort((a, b) => a.order - b.order),
      sortBy: 'custom',
      lastUpdated: new Date().toISOString(),
    };

    savePreferences(newPrefs);
  }, [preferences, savePreferences]);

  // Toggle ticker visibility
  const toggleTicker = useCallback((tickerId: string) => {
    if (!preferences) return;

    const newTickers = preferences.tickers.map(t =>
      t.id === tickerId ? { ...t, visible: !t.visible } : t
    );

    savePreferences({
      ...preferences,
      tickers: newTickers,
      lastUpdated: new Date().toISOString(),
    });
  }, [preferences, savePreferences]);

  // Reorder tickers (drag and drop)
  const reorderTickers = useCallback((fromIndex: number, toIndex: number) => {
    if (!preferences) return;

    const visibleTickers = preferences.tickers.filter(t => t.visible);
    const [moved] = visibleTickers.splice(fromIndex, 1);
    visibleTickers.splice(toIndex, 0, moved);

    // Update order for visible tickers
    const reorderedVisible = visibleTickers.map((t, i) => ({ ...t, order: i }));

    // Merge back with hidden tickers
    const hiddenTickers = preferences.tickers.filter(t => !t.visible);
    const newTickers = [...reorderedVisible, ...hiddenTickers];

    savePreferences({
      ...preferences,
      tickers: newTickers,
      sortBy: 'custom',
      lastUpdated: new Date().toISOString(),
    });
  }, [preferences, savePreferences]);

  // Add a ticker to visible list
  const addTicker = useCallback((tickerId: string) => {
    if (!preferences) return;

    const maxOrder = Math.max(...preferences.tickers.filter(t => t.visible).map(t => t.order), -1);

    const newTickers = preferences.tickers.map(t =>
      t.id === tickerId ? { ...t, visible: true, order: maxOrder + 1 } : t
    );

    savePreferences({
      ...preferences,
      tickers: newTickers,
      lastUpdated: new Date().toISOString(),
    });
  }, [preferences, savePreferences]);

  // Remove a ticker from visible list
  const removeTicker = useCallback((tickerId: string) => {
    if (!preferences) return;

    const newTickers = preferences.tickers.map(t =>
      t.id === tickerId ? { ...t, visible: false, order: 999 } : t
    );

    savePreferences({
      ...preferences,
      tickers: newTickers,
      lastUpdated: new Date().toISOString(),
    });
  }, [preferences, savePreferences]);

  // Set sort order
  const setSortBy = useCallback((sortBy: TickerPreferences['sortBy']) => {
    if (!preferences) return;

    savePreferences({
      ...preferences,
      sortBy,
      lastUpdated: new Date().toISOString(),
    });
  }, [preferences, savePreferences]);

  // Get visible tickers in order
  const getVisibleTickers = useCallback(() => {
    if (!preferences) return [];
    return preferences.tickers
      .filter(t => t.visible)
      .sort((a, b) => a.order - b.order);
  }, [preferences]);

  // Get hidden tickers
  const getHiddenTickers = useCallback(() => {
    if (!preferences) return [];
    return preferences.tickers.filter(t => !t.visible);
  }, [preferences]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPreferences(null);
  }, []);

  return {
    preferences,
    loading,
    initializeWithPrices,
    toggleTicker,
    reorderTickers,
    addTicker,
    removeTicker,
    setSortBy,
    getVisibleTickers,
    getHiddenTickers,
    resetToDefaults,
  };
}

export default useTickerPreferences;
