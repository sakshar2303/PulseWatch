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

    // Fallback simulation if WebSocket is offline (e.g. static demo mode)
    const simInterval = setInterval(() => {
      if (wsService.getStatus() !== 'connected') {
        setStatus('connected');
        const metricName = (metricsFilter.current && metricsFilter.current[0]) || 'system.cpu.usage';
        const simPoint: MetricPoint = {
          timestamp: new Date().toISOString(),
          metric_name: metricName,
          host: hostFilter.current || 'web-prod-01',
          service: serviceFilter.current || 'checkout-service',
          value: Math.round((45 + Math.random() * 25) * 10) / 10,
          tags: { env: 'production', region: 'us-east-1' },
        };
        setLastTick(new Date());
        setPoints((prev) => {
          const next = [...prev, simPoint];
          if (next.length > maxPoints) {
            return next.slice(next.length - maxPoints);
          }
          return next;
        });
      }
    }, 3000);

    return () => {
      clearInterval(simInterval);
      unsubStatus();
      unsubMetric();
    };
  }, [maxPoints, metrics]);

  const clearPoints = () => setPoints([]);

  return { points, status, lastTick, clearPoints };
}
