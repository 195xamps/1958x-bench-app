import { useState, useRef, useCallback } from 'react';

interface CachedFetchOptions {
  /** Minimum seconds before refetching on focus. Default 30. */
  staleTime?: number;
}

/**
 * Hook that returns cached data immediately and refreshes in background.
 * Use with useFocusEffect to avoid re-fetching on every tab switch.
 */
export function useCachedFetch<T>(
  fetchFn: () => Promise<T>,
  options: CachedFetchOptions = {},
) {
  const { staleTime = 30 } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<number>(0);
  const initialLoadDone = useRef(false);

  const refresh = useCallback(async (force = false) => {
    const now = Date.now();
    const elapsed = (now - lastFetchRef.current) / 1000;

    // If data exists and it's fresh, skip
    if (!force && initialLoadDone.current && elapsed < staleTime) {
      return;
    }

    // Only show loading spinner on first load
    if (!initialLoadDone.current) {
      setLoading(true);
    }

    try {
      setError(null);
      const result = await fetchFn();
      setData(result);
      lastFetchRef.current = Date.now();
      initialLoadDone.current = true;
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch');
      // Keep stale data visible on error
    } finally {
      setLoading(false);
    }
  }, [fetchFn, staleTime]);

  /** Force a fresh fetch regardless of staleTime */
  const forceRefresh = useCallback(() => refresh(true), [refresh]);

  return { data, loading, error, refresh, forceRefresh, setData };
}
