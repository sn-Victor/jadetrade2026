import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search, TrendingUp, TrendingDown } from 'lucide-react';
import { usePriceDisplay } from '@/hooks/usePrices';

interface PriceChipProps {
  symbol: string;
  price: number;
  change: number;
}

const PriceChip = ({ symbol, price, change }: PriceChipProps) => (
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 flex-shrink-0">
    <span className="text-xs text-muted-foreground font-medium">{symbol}</span>
    <span className="text-sm font-mono font-semibold text-foreground">
      ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
    <span className={`text-xs font-medium flex items-center gap-0.5 ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
      {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {change >= 0 ? '+' : ''}{change.toFixed(2)}%
    </span>
  </div>
);

interface PriceTickerProps {
  showSearch?: boolean;
  maxItems?: number;
}

export const PriceTicker = ({ showSearch = true, maxItems = 8 }: PriceTickerProps) => {
  const { priceList, loading, error } = usePriceDisplay();
  const [tokenSearch, setTokenSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Filter prices based on search
  const filteredPrices = tokenSearch
    ? priceList.filter(p => p.symbol.toLowerCase().includes(tokenSearch.toLowerCase()))
    : priceList;

  const displayedPrices = filteredPrices.slice(0, maxItems);

  // Check scroll position
  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  useEffect(() => {
    checkScroll();
    const scrollEl = scrollRef.current;
    if (scrollEl) {
      scrollEl.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        scrollEl.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [displayedPrices]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="relative z-10 border-b border-white/5 bg-black/10 backdrop-blur-sm">
      <div className="px-6 py-3">
        <div className="flex items-center gap-4">
          {/* Live indicator */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : error ? 'bg-red-400' : 'bg-emerald-400 animate-pulse'}`} />
            <span className="text-xs text-muted-foreground">
              {loading ? 'Loading...' : error ? 'Offline' : 'Live'}
            </span>
          </div>

          {/* Search input */}
          {showSearch && (
            <div className="relative flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search token..."
                value={tokenSearch}
                onChange={(e) => setTokenSearch(e.target.value)}
                className="w-40 pl-9 pr-3 py-1.5 text-sm rounded-full bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50"
              />
            </div>
          )}

          {/* Scroll left button */}
          <button
            onClick={() => scroll('left')}
            className={`p-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex-shrink-0 ${
              canScrollLeft ? 'opacity-100' : 'opacity-30 cursor-not-allowed'
            }`}
            disabled={!canScrollLeft}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Price chips - scrollable */}
          <div
            ref={scrollRef}
            className="flex items-center gap-3 overflow-x-auto scrollbar-hide flex-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {displayedPrices.map((p) => (
              <PriceChip key={p.symbol} symbol={p.symbol} price={p.price} change={p.change} />
            ))}
          </div>

          {/* Scroll right button */}
          <button
            onClick={() => scroll('right')}
            className={`p-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex-shrink-0 ${
              canScrollRight ? 'opacity-100' : 'opacity-30 cursor-not-allowed'
            }`}
            disabled={!canScrollRight}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PriceTicker;
