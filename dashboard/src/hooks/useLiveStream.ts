import { useState, useEffect, useRef } from 'react';
import { wsService, ConnectionStatus } from '../services/websocket';
import { MetricPoint } from '../types';

export interface UseLiveStreamOptions {
  metrics?: string[];
  maxPoints?: number;
  host?: string;
  service?: string;
}

export function useLiveStream({
  metrics,
  maxPoints = 60,
  host,
  service,
}: UseLiveStreamOptions = {}) {
  const [points, setPoints] = useState<MetricPoint[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>(wsService.getStatus());
  const [lastTick, setLastTick] = useState<Date | null>(null);

  const metricsFilter = useRef(metrics);
  metricsFilter.current = metrics;

  const hostFilter = useRef(host);
  hostFilter.current = host;

  const serviceFilter = useRef(service);
  serviceFilter.current = service;

  useEffect(() => {
    // Subscribe to desired metrics
    wsService.subscribe(metrics);

    const unsubStatus = wsService.onStatus((newStatus) => {
      setStatus(newStatus);
    });

    const unsubMetric = wsService.onMetric((point) => {
      // Filter by host/service if specified
      if (hostFilter.current && point.host !== hostFilter.current) return;
      if (serviceFilter.current && point.service !== serviceFilter.current) return;

      // Filter by metric if specified
      if (metricsFilter.current && metricsFilter.current.length > 0) {
        if (!metricsFilter.current.includes(point.metric_name)) return;
      }

      setLastTick(new Date());
      setPoints((prev) => {
        const next = [...prev, point];
        if (next.length > maxPoints) {
          return next.slice(next.length - maxPoints);
        }
        return next;
      });
    });

    return () => {
      unsubStatus();
      unsubMetric();
    };
  }, [maxPoints, metrics]);

  const clearPoints = () => setPoints([]);

  return { points, status, lastTick, clearPoints };
}
