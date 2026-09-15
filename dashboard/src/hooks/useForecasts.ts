import { useState, useEffect } from 'react';
import { fetchForecasts, Forecast } from '../services/api';

export function useForecasts(metric: string, host: string, service: string) {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!metric) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchForecasts(metric, host, service);
      setForecasts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch forecasts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [metric, host, service]);

  return { forecasts, loading, error, refetch: load };
}
