import { MetricPoint } from '../types';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export type MetricListener = (point: MetricPoint) => void;
export type StatusListener = (status: ConnectionStatus) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = 'disconnected';
  private metricListeners: Set<MetricListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: number | null = null;
  private subscribedMetrics: Set<string> = new Set();
  private subscribedServices: Set<string> = new Set();
  private subscribedHosts: Set<string> = new Set();

  constructor() {
    // Lazy connect on subscription
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/live`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        this.sendSubscription();
      };

      this.ws.onmessage = (event) => {
        try {
          // Handle line-delimited or single JSON payloads
          const lines = event.data.split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            const parsed = JSON.parse(line);
            if (parsed.type === 'metric' && parsed.data) {
              const point: MetricPoint = parsed.data;
              this.metricListeners.forEach((listener) => listener(point));
            }
          }
        } catch {
          // Ignore parse errors on ping/pong frames
        }
      };

      this.ws.onclose = () => {
        this.setStatus('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.setStatus('error');
      };
    } catch {
      this.setStatus('error');
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  public subscribe(metrics?: string[], services?: string[], hosts?: string[]): void {
    if (metrics) metrics.forEach((m) => this.subscribedMetrics.add(m));
    if (services) services.forEach((s) => this.subscribedServices.add(s));
    if (hosts) hosts.forEach((h) => this.subscribedHosts.add(h));

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    } else {
      this.sendSubscription();
    }
  }

  public unsubscribe(metrics?: string[]): void {
    if (metrics) {
      metrics.forEach((m) => this.subscribedMetrics.delete(m));
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          action: 'unsubscribe',
          metrics: metrics || [],
        })
      );
    }
  }

  private sendSubscription(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        action: 'subscribe',
        metrics: Array.from(this.subscribedMetrics),
        services: Array.from(this.subscribedServices),
        hosts: Array.from(this.subscribedHosts),
      })
    );
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  public onMetric(listener: MetricListener): () => void {
    this.metricListeners.add(listener);
    return () => this.metricListeners.delete(listener);
  }

  public onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }
}

export const wsService = new WebSocketService();
