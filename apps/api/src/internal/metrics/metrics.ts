import client from 'prom-client';
import type { MetricsInterface } from '../../domain/metrics/interface.js';

export function buildMetrics(): MetricsInterface {
  const register = new client.Registry();

  client.collectDefaultMetrics({ register });

  const httpRequestsTotal = new client.Counter({
    name: 'lokaslip_http_requests_total',
    help: 'Total number of HTTP requests processed',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [register],
  });

  const httpRequestDurationSeconds = new client.Histogram({
    name: 'lokaslip_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [register],
  });

  const emailsTotal = new client.Counter({
    name: 'lokaslip_emails_total',
    help: 'Total number of emails processed',
    labelNames: ['result'] as const,
    registers: [register],
  });

  const queueMessagesTotal = new client.Counter({
    name: 'lokaslip_queue_messages_total',
    help: 'Total number of queue messages handled',
    labelNames: ['queue', 'outcome'] as const,
    registers: [register],
  });

  const rateLimitWaitSeconds = new client.Histogram({
    name: 'lokaslip_rate_limit_wait_seconds',
    help: 'Time spent waiting for rate limit tokens in seconds',
    registers: [register],
  });

  const campaignsFinishedTotal = new client.Counter({
    name: 'lokaslip_campaigns_finished_total',
    help: 'Total number of campaigns finished',
    registers: [register],
  });

  return {
    recordHttpRequest({ method, route, status, durationSeconds }): void {
      const statusStr = String(status);
      httpRequestsTotal.inc({ method, route, status: statusStr });
      httpRequestDurationSeconds.observe({ method, route, status: statusStr }, durationSeconds);
    },

    recordEmailResult(result: 'sent' | 'failed'): void {
      emailsTotal.inc({ result });
    },

    recordQueueMessage({ queue, outcome }): void {
      queueMessagesTotal.inc({ queue, outcome });
    },

    recordRateLimitWait(seconds: number): void {
      rateLimitWaitSeconds.observe(seconds);
    },

    recordCampaignFinished(): void {
      campaignsFinishedTotal.inc();
    },

    async render(): Promise<string> {
      return register.metrics();
    },

    get contentType(): string {
      return register.contentType;
    },
  };
}
