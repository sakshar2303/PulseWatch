import { useState, useEffect, useCallback } from 'react';
import { fetchSLO } from '../services/api';
import { SLOResponse } from '../types/omium';

export function useSLO(pollIntervalMs: number = 10000) {
  const [sloData, setSloData] = useState<SLOResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchSLO();
      setSloData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch SLO metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(interval);
  }, [refresh, pollIntervalMs]);

  return { sloData, loading, error, refresh };
}
