import { useState, useEffect, useCallback } from 'react';
import {
  fetchHealth,
  fetchServices,
  fetchHosts,
  fetchAnomalies,
  fetchMetricNames,
} from '../services/api';
import {
  HealthResponse,
  ServiceInfo,
  HostInfo,
  Anomaly,
} from '../types';

export function useFleet(refreshIntervalMs = 15000) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [hosts, setHosts] = useState<HostInfo[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [metricNames, setMetricNames] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const refreshFleet = useCallback(async () => {
    try {
      const [hRes, sRes, hoRes, aRes, mRes] = await Promise.allSettled([
        fetchHealth(),
        fetchServices(),
        fetchHosts(),
        fetchAnomalies({ limit: 10 }),
        fetchMetricNames(),
      ]);

      if (hRes.status === 'fulfilled') setHealth(hRes.value);
      if (sRes.status === 'fulfilled') setServices(sRes.value);
      if (hoRes.status === 'fulfilled') setHosts(hoRes.value);
      if (aRes.status === 'fulfilled') setAnomalies(aRes.value.anomalies);
      if (mRes.status === 'fulfilled') setMetricNames(mRes.value);

      setLastUpdated(new Date());
    } catch {
      // Keep previous state on transient failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFleet();
    if (refreshIntervalMs > 0) {
      const timer = setInterval(refreshFleet, refreshIntervalMs);
      return () => clearInterval(timer);
    }
  }, [refreshFleet, refreshIntervalMs]);

  return {
    health,
    services,
    hosts,
    anomalies,
    metricNames,
    loading,
    lastUpdated,
    refreshFleet,
  };
}
