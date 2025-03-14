import { atom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useCallback, useEffect, useMemo, useRef } from "react";

// Map token symbols to their Coinranking IDs
const tokenSymbolToId: Record<string, string> = {
  DOT: "25W7FG7om",
  USDT: "HIVsRcGKkPFtW",
  USDC: "aKzUVe4Hh_CON",
  VARCH: "P8XRpAlbm",
};

interface TokenPrice {
  symbol: string;
  price: number;
  lastUpdated: number;
}

// Cache duration in milliseconds (10 minutes)
const CACHE_DURATION = 10 * 60 * 1000;

// Store prices in localStorage to persist across page reloads
// This helps prevent unnecessary API calls
const pricesStorageAtom = atomWithStorage<Record<string, TokenPrice>>("token-prices", {});

// Separate atoms for different aspects of state to minimize re-renders
const pricesAtom = atom(
  (get) => get(pricesStorageAtom),
  (_get, set, prices: Record<string, TokenPrice>) => {
    set(pricesStorageAtom, prices);
  }
);

const isLoadingAtom = atom(false);
const errorAtom = atom<string | null>(null);
const lastFullUpdateAtom = atom<number>(0);

// Single global price fetcher instance
let priceUpdatePromise: Promise<void> | null = null;
let lastApiCallTime = 0;
const API_CALL_THROTTLE = 1000; // 1 second between API calls

/**
 * Fetches price for a single token
 */
async function fetchTokenPrice(symbol: string): Promise<number | null> {
  const id = tokenSymbolToId[symbol.toUpperCase()];
  if (!id) return null;

  try {
    // Throttle API calls
    const now = Date.now();
    const timeToWait = Math.max(0, API_CALL_THROTTLE - (now - lastApiCallTime));
    if (timeToWait > 0) {
      await new Promise(resolve => setTimeout(resolve, timeToWait));
    }
    
    lastApiCallTime = Date.now();
    
    const response = await fetch(
      `https://api.coinranking.com/v2/coin/${id}/price`,
      {
        headers: {
          Accept: "application/json",
          "x-access-token": "", // Using public API access
          Origin: window.location.origin,
        },
        mode: "cors",
      },
    );

    if (!response.ok) {
      console.warn(`Price fetch failed for ${symbol}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const price = data?.data?.price ? parseFloat(data.data.price) : null;

    if (!price || isNaN(price)) {
      return null;
    }

    return price;
  } catch (error) {
    console.warn(`Price fetch error for ${symbol}:`, error);
    return null;
  }
}

// Import jotai directly to avoid require() which is forbidden by ESLint
import * as jotaiLib from 'jotai';

/**
 * Updates prices for all tokens or specific symbols
 */
async function updatePrices(forceUpdate = false): Promise<void> {
  // If there's already an update in progress, return that promise
  if (priceUpdatePromise) {
    return priceUpdatePromise;
  }
  
  // Use jotai's default store
  const store = jotaiLib.getDefaultStore();
  
  const now = Date.now();
  const currentPrices = store.get(pricesAtom);
  const lastFullUpdate = store.get(lastFullUpdateAtom);
  const needsFullUpdate = forceUpdate || now - lastFullUpdate > CACHE_DURATION;
  
  // Determine which symbols need updating
  const symbolsToUpdate = needsFullUpdate 
    ? Object.keys(tokenSymbolToId)
    : Object.keys(tokenSymbolToId).filter(symbol => {
        const lastUpdate = currentPrices[symbol]?.lastUpdated ?? 0;
        return now - lastUpdate > CACHE_DURATION;
      });
  
  if (symbolsToUpdate.length === 0) {
    return Promise.resolve();
  }
  
  store.set(isLoadingAtom, true);
  store.set(errorAtom, null);
  
  // Create and store the promise
  priceUpdatePromise = (async () => {
    try {
      const newPrices: Record<string, TokenPrice> = {};
      
      // Process one symbol at a time to avoid overwhelming the API
      for (const symbol of symbolsToUpdate) {
        const price = await fetchTokenPrice(symbol);
        
        if (price !== null) {
          // Only update if price changed significantly (0.01% threshold)
          const currentPrice = currentPrices[symbol.toUpperCase()]?.price;
          const priceChanged = !currentPrice || 
            Math.abs((price - currentPrice) / currentPrice) > 0.0001;
            
          if (priceChanged) {
            newPrices[symbol.toUpperCase()] = {
              symbol: symbol.toUpperCase(),
              price,
              lastUpdated: now,
            };
          } else {
            // Just update the timestamp if price didn't change significantly
            newPrices[symbol.toUpperCase()] = {
              symbol: symbol.toUpperCase(),
              price: currentPrices[symbol.toUpperCase()]?.price || 0,
              lastUpdated: now,
            };
          }
        }
      }
      
      // Update prices
      store.set(pricesAtom, { ...currentPrices, ...newPrices });
      
      // Update last full update timestamp if needed
      if (needsFullUpdate) {
        store.set(lastFullUpdateAtom, now);
      }
    } catch (error) {
      store.set(errorAtom, error instanceof Error ? error.message : "Failed to fetch prices");
    } finally {
      store.set(isLoadingAtom, false);
      priceUpdatePromise = null;
    }
  })();
  
  return priceUpdatePromise;
}

/**
 * Hook to access and update token prices
 */
export function useTokenPrices() {
  const prices = useAtomValue(pricesAtom);
  const isLoading = useAtomValue(isLoadingAtom);
  const error = useAtomValue(errorAtom);
  const lastFullUpdate = useAtomValue(lastFullUpdateAtom);
  
  // Reference to track initialization
  const initialized = useRef(false);
  const intervalRef = useRef<number | null>(null);
  
  // Function to trigger a price update
  const refresh = useCallback((forceUpdate = false) => {
    updatePrices(forceUpdate);
  }, []);
  
  // Initialize price fetching
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      
      // Initial fetch
      refresh();
      
      // Setup interval for periodic updates (every 10 minutes)
      intervalRef.current = window.setInterval(() => {
        refresh();
      }, CACHE_DURATION);
    }
    
    // Cleanup
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [refresh]);
  
  return {
    prices,
    isLoading,
    error,
    lastFullUpdate,
    refresh,
  };
}

/**
 * Hook to get price for a specific token
 */
export function useTokenPrice(symbol: string): number {
  const { prices } = useTokenPrices();
  return prices[symbol.toUpperCase()]?.price ?? 0;
}

/**
 * Calculate token value based on amount, decimals, and price
 */
export function calculateTokenValue(
  amount: bigint | undefined,
  decimals: number,
  price: number,
): number {
  if (!amount) return 0;
  const value = Number(amount) / 10 ** decimals;
  return value * price;
}

/**
 * Hook to calculate total value of tokens
 */
export function useTotalValue(
  tokens: Array<{
    metadata: { symbol: string; decimals: number };
    value: { free: bigint; reserved?: bigint; frozen?: bigint; flags?: bigint } | { free: bigint };
  }>,
): { total: number; isLoading: boolean } {
  const { prices, isLoading } = useTokenPrices();
  
  // Memoize the total calculation to prevent unnecessary recalculations
  const total = useMemo(() => {
    return tokens.reduce((total, token) => {
      const symbol = token.metadata.symbol.toUpperCase();
      const price = prices[symbol]?.price ?? 0;
      
      // Handle different value object shapes
      const free = "free" in token.value ? token.value.free : BigInt(0);
      
      const value = calculateTokenValue(free, token.metadata.decimals, price);
      return total + value;
    }, 0);
  }, [tokens, prices]);

  return { total, isLoading };
}
