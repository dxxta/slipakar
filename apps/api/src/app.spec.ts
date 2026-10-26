import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { Router } from 'express';
import { createApp } from './app.js';

describe('GET /health', () => {
  it('returns an ok status', async () => {
    const response = await request(createApp()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

describe('error handling', () => {
  it('returns a safe response for malformed JSON', async () => {
    const response = await request(createApp())
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: 'INTERNAL', message: 'Internal server error' },
    });
  });
});

describe('router mounting', () => {
  it('mounts provided routers in order before the error handler', async () => {
    const calls: string[] = [];
    const first = Router().get('/first', (_request, response) => {
      calls.push('first');
      response.json({ ok: 1 });
    });
    const second = Router().get('/second', (_request, response) => {
      calls.push('second');
      response.json({ ok: 2 });
    });

    const app = createApp({ routers: [first, second] });

    expect((await request(app).get('/first')).body).toEqual({ ok: 1 });
    expect((await request(app).get('/second')).body).toEqual({ ok: 2 });
    expect(calls).toEqual(['first', 'second']);
  });
});

describe('middleware option', () => {
  it('runs provided middleware before the routers', async () => {
    const order: string[] = [];
    const router = Router().get('/ping', (_request, response) => {
      order.push('router');
      response.json({ ok: true });
    });
    const app = createApp({
      middleware: [
        (_request, _response, next) => {
          order.push('middleware');
          next();
        },
      ],
      routers: [router],
    });

    await request(app).get('/ping');

    expect(order).toEqual(['middleware', 'router']);
  });
});

describe('trust proxy configuration', () => {
  it('resolves client IP with trust proxy hop count 1', async () => {
    const router = Router().get('/ip-check', (req, res) => {
      res.json({ ip: req.ip, ips: req.ips });
    });
    const app = createApp({
      trustProxy: '1',
      routers: [router],
    });

    const res = await request(app)
      .get('/ip-check')
      .set('X-Forwarded-For', '203.0.113.195');

    expect(res.status).toBe(200);
    expect(res.body.ip).toBe('203.0.113.195');
  });

  it('ignores spoofed X-Forwarded-For with trust proxy false', async () => {
    const router = Router().get('/ip-check', (req, res) => {
      res.json({ ip: req.ip, ips: req.ips });
    });
    const app = createApp({
      trustProxy: 'false',
      routers: [router],
    });

    const res = await request(app)
      .get('/ip-check')
      .set('X-Forwarded-For', '203.0.113.195');

    expect(res.status).toBe(200);
    // When trust proxy is false, Express uses socket remoteAddress (127.0.0.1 or ::ffff:127.0.0.1)
    expect(res.body.ip).not.toBe('203.0.113.195');
    expect(res.body.ips).toEqual([]);
  });
});
