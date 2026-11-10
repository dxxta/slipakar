import { describe, expect, it } from 'vitest';
import { buildMetrics } from './metrics.js';
import { noopMetrics } from './noop.js';

describe('Metrics', () => {
  it('noopMetrics performs all methods without error and returns empty string', async () => {
    noopMetrics.recordHttpRequest({ method: 'GET', route: '/test', status: 200, durationSeconds: 0.1 });
    noopMetrics.recordEmailResult('sent');
    noopMetrics.recordEmailResult('failed');
    noopMetrics.recordQueueMessage({ queue: 'email', outcome: 'processed' });
    noopMetrics.recordQueueMessage({ queue: 'email', outcome: 'rejected' });
    noopMetrics.recordRateLimitWait(1.5);
    noopMetrics.recordCampaignFinished();

    const output = await noopMetrics.render();
    expect(output).toBe('');
    expect(typeof noopMetrics.contentType).toBe('string');
  });

  it('each record function changes the rendered output', async () => {
    const metrics = buildMetrics();

    metrics.recordHttpRequest({ method: 'GET', route: '/api/v1/test', status: 200, durationSeconds: 0.05 });
    const afterHttp = await metrics.render();
    expect(afterHttp).toContain('slipakar_http_requests_total{method="GET",route="/api/v1/test",status="200"} 1');
    expect(afterHttp).toContain('slipakar_http_request_duration_seconds');

    metrics.recordEmailResult('sent');
    metrics.recordEmailResult('failed');
    const afterEmail = await metrics.render();
    expect(afterEmail).toContain('slipakar_emails_total{result="sent"} 1');
    expect(afterEmail).toContain('slipakar_emails_total{result="failed"} 1');

    metrics.recordQueueMessage({ queue: 'slipakar.send-email', outcome: 'processed' });
    metrics.recordQueueMessage({ queue: 'slipakar.notify', outcome: 'rejected' });
    const afterQueue = await metrics.render();
    expect(afterQueue).toContain('slipakar_queue_messages_total{queue="slipakar.send-email",outcome="processed"} 1');
    expect(afterQueue).toContain('slipakar_queue_messages_total{queue="slipakar.notify",outcome="rejected"} 1');

    metrics.recordRateLimitWait(2.5);
    const afterRateLimit = await metrics.render();
    expect(afterRateLimit).toContain('slipakar_rate_limit_wait_seconds');

    metrics.recordCampaignFinished();
    const afterCampaign = await metrics.render();
    expect(afterCampaign).toContain('slipakar_campaigns_finished_total 1');
  });

  it('two buildMetrics() calls do not share counts', async () => {
    const metrics1 = buildMetrics();
    const metrics2 = buildMetrics();

    metrics1.recordCampaignFinished();
    metrics1.recordEmailResult('sent');

    const out1 = await metrics1.render();
    const out2 = await metrics2.render();

    expect(out1).toContain('slipakar_campaigns_finished_total 1');
    expect(out2).not.toContain('slipakar_campaigns_finished_total 1');
    expect(out1).toContain('slipakar_emails_total{result="sent"} 1');
    expect(out2).not.toContain('slipakar_emails_total{result="sent"} 1');
  });

  it('the status label is the numeric status as string', async () => {
    const metrics = buildMetrics();
    metrics.recordHttpRequest({ method: 'POST', route: '/unmatched', status: 404, durationSeconds: 0.01 });

    const out = await metrics.render();
    expect(out).toContain('slipakar_http_requests_total{method="POST",route="/unmatched",status="404"} 1');
    expect(out).toContain('status="404"');
  });
});
