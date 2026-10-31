import type { MetricsInterface } from '../../domain/metrics/interface.js';

export const noopMetrics: MetricsInterface = {
  recordHttpRequest(): void {},
  recordEmailResult(): void {},
  recordQueueMessage(): void {},
  recordRateLimitWait(): void {},
  recordCampaignFinished(): void {},
  async render(): Promise<string> {
    return '';
  },
  contentType: 'text/plain; version=0.0.4; charset=utf-8',
};
