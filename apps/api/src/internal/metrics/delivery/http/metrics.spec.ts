import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildMetrics } from '../../metrics.js';
import { createMetricsRouter } from './metrics.js';

describe('Metrics HTTP delivery', () => {
  it('open without token', async () => {
    const metrics = buildMetrics();
    const router = createMetricsRouter({ metrics });
    const app = express();
    app.use(router);

    const res = await request(app).get('/metrics').expect(200);
    expect(res.headers['content-type']).toContain(metrics.contentType);
    expect(res.text).toContain('slipakar_');
  });

  it('401 without header when token is configured', async () => {
    const metrics = buildMetrics();
    const router = createMetricsRouter({ metrics, token: 'secret-token-123' });
    const app = express();
    app.use(router);

    const res = await request(app).get('/metrics').expect(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
    expect(res.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
      },
    });
  });

  it('401 with wrong token of the same length and of different length', async () => {
    const metrics = buildMetrics();
    const router = createMetricsRouter({ metrics, token: 'secret-1234' });
    const app = express();
    app.use(router);

    // Wrong token with same length
    const resSameLen = await request(app)
      .get('/metrics')
      .set('Authorization', 'Bearer wrong-1234')
      .expect(401);
    expect(resSameLen.headers['www-authenticate']).toBe('Bearer');
    expect(resSameLen.body.error.code).toBe('UNAUTHENTICATED');

    // Wrong token with different length
    const resDiffLen = await request(app)
      .get('/metrics')
      .set('Authorization', 'Bearer wrong-short')
      .expect(401);
    expect(resDiffLen.headers['www-authenticate']).toBe('Bearer');
    expect(resDiffLen.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('200 with the right token', async () => {
    const metrics = buildMetrics();
    const router = createMetricsRouter({ metrics, token: 'my-secret-token' });
    const app = express();
    app.use(router);

    const res = await request(app)
      .get('/metrics')
      .set('Authorization', 'Bearer my-secret-token')
      .expect(200);

    expect(res.headers['content-type']).toContain(metrics.contentType);
    expect(res.text).toContain('slipakar_');
  });
});
