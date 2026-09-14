import { useState, useEffect, useCallback, useRef } from 'react';
import { queryMetrics, QueryMetricsParams } from '../services/api';
import { QueryResult, TimeRangePreset } from '../types';

export const TIME_RANGE_CONFIGS: Record<TimeRangePreset, { label: string; durationMinutes: number; defaultStep: string }> = {
  '5m': { label: 'Last 5m', durationMinutes: 5, defaultStep: '5s' },
  '15m': { label: 'Last 15m', durationMinutes: 15, defaultStep: '15s' },
  '1h': { label: 'Last 1h', durationMinutes: 60, defaultStep: '1m' },
  '6h': { label: 'Last 6h', durationMinutes: 360, defaultStep: '5m' },
  '24h': { label: 'Last 24h', durationMinutes: 1440, defaultStep: '15m' },
  '7d': { label: 'Last 7d', durationMinutes: 10080, defaultStep: '1h' },
};

export interface UseMetricsOptions {
  name: string;
  timeRange: TimeRangePreset;
  agg?: 'avg' | 'max' | 'min' | 'sum' | 'count';
  step?: string;
  host?: string;
  service?: string;
  refreshIntervalMs?: number; // 0 to disable
}

export function useMetrics({
  name,
  timeRange,
  agg = 'avg',
  step,
  host,
  service,
  refreshIntervalMs = 10000,
}: UseMetricsOptions) {
  const [data, setData] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const calculateParams = useCallback((): QueryMetricsParams => {
    const config = TIME_RANGE_CONFIGS[timeRange] || TIME_RANGE_CONFIGS['1h'];
    const now = new Date();
    const start = new Date(now.getTime() - config.durationMinutes * 60 * 1000);

    return {
      name,
      start: start.toISOString(),
      end: now.toISOString(),
      step: step || config.defaultStep,
      agg,
      host: host || undefined,
      service: service || undefined,
    };
  }, [name, timeRange, step, agg, host, service]);

  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const params = calculateParams();
      const res = await queryMetrics(params);
      if (isMounted.current) {
        setData(res);
        setError(null);
      }
    } catch (err: any) {
      if (isMounted.current) {
        setError(err.message || 'Failed to query metric');
      }
    } finally {
      if (isMounted.current && isInitial) {
        setLoading(false);
      }
    }
  }, [calculateParams]);

  useEffect(() => {
    isMounted.current = true;
    loadData(true);

    if (refreshIntervalMs > 0) {
      const timer = setInterval(() => {
        loadData(false);
      }, refreshIntervalMs);
      return () => {
        isMounted.current = false;
        clearInterval(timer);
      };
    }

    return () => {
      isMounted.current = false;
    };
  }, [loadData, refreshIntervalMs]);

  return { data, loading, error, refetch: () => loadData(false) };
}
