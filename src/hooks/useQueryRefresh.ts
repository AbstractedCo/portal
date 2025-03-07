import { useEffect } from 'react';

export function useQueryRefresh(refreshFn: () => Promise<void>, intervalMs: number = 3000) {
  useEffect(() => {
    const interval = setInterval(refreshFn, intervalMs);
    return () => clearInterval(interval);
  }, [refreshFn, intervalMs]);
} 