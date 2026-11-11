import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { PrismaClient } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import type { QueueInterface } from './domain/queue/interface.js';
import { buildApp, buildApplication } from './composition.js';

const env = {
  DATABASE_URL: 'postgresql://localhost/db',
  APP_ENCRYPTION_KEY: 'a'.repeat(64),
  GOOGLE_CLIENT_ID: 'google-id',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  BETTER_AUTH_SECRET: 'auth-secret',
  BETTER_AUTH_URL: 'http://localhost:3000',
  TRUSTED_ORIGINS: [],
  API_ACCESS_ENABLED: false,
  API_ALLOWED_ORIGINS: [],
  EMBED_ALLOWED_ORIGINS: [],
  S3_ENDPOINT: 'localhost',
  S3_PORT: 3900,
  S3_USE_SSL: false,
  S3_ACCESS_KEY: 's3-access',
  S3_SECRET_KEY: 's3-secret',
  S3_BUCKET: 'slipakar',
  S3_REGION: 'garage',
  S3_PATH_STYLE: true,
  REDIS_URL: 'redis://localhost:6379',
  RABBITMQ_URL: 'amqp://guest:guest@localhost:5672',
  ADMIN_EMAILS: [],
  PORT: 3000,
};

describe('buildApp', () => {
  const app = buildApp({ env, prisma: {} as PrismaClient });

  it('keeps health public', async () => {
    expect((await request(app).get('/health')).status).toBe(200);
  });

  it('protects projects and smtp routes with authentication', async () => {
    expect((await request(app).get('/projects')).status).toBe(401);
    expect((await request(app).get('/projects/p1/smtp')).status).toBe(401);
  });

  it('does not block the auth routes behind requireAuth', async () => {
    const response = await request(app).get('/api/auth/ok');
    expect(response.status).not.toBe(401);
  });

  describe('with an authenticated user', () => {
    const authedApp = buildApp({
      env,
      prisma: {} as PrismaClient,
      requireAuth: (req, res, next) => {
        req.user = { id: 'u1', email: 'u1@example.com', role: 'user' };
        res.locals.userId = 'u1';
        next();
      },
    });

    it.each([
      ['get', '/projects/p1/templates'],
      ['get', '/projects/p1/uploads'],
      ['get', '/projects/p1/mappings?templateId=t&uploadId=u'],
      ['post', '/projects/p1/preview'],
    ] as const)('mounts %s %s', async (method, path) => {
      const response = await request(authedApp)[method](path).send({});
      // Reaching a handler fails on the fake prisma (500) or on validation (400); unmounted would be 404.
      expect([400, 500]).toContain(response.status);
    });
  });

  describe('storage, attachments and admin config', () => {
    const fakeRedis = {
      publish: async (): Promise<number> => 0,
      subscribe: async (): Promise<unknown> => undefined,
      unsubscribe: async (): Promise<unknown> => undefined,
      on: (): unknown => undefined,
    };
    const fakeAuth = (
      req: Request,
      res: Response,
      next: NextFunction,
    ): void => {
      req.user = { id: 'u1', email: 'u1@example.com', role: 'user' };
      res.locals.userId = 'u1';
      next();
    };
    const build = (adminEmails: string[]): ReturnType<typeof buildApp> =>
      buildApp({
        env: { ...env, ADMIN_EMAILS: adminEmails },
        prisma: {} as PrismaClient,
        requireAuth: fakeAuth,
        redis: { publisher: fakeRedis, subscriber: fakeRedis },
      });

    it.each([
      ['get', '/projects/p1/attachments'],
      ['get', '/projects/p1/storage'],
      ['get', '/admin/config'],
    ] as const)('requires authentication for %s %s', async (method, path) => {
      expect((await request(app)[method](path)).status).toBe(401);
    });

    it.each([
      ['get', '/projects/p1/attachments'],
      ['get', '/projects/p1/storage'],
    ] as const)('mounts %s %s', async (method, path) => {
      const response = await request(build([]))[method](path);
      expect([400, 500]).toContain(response.status);
    });

    it('rejects a signed-in non-admin on the admin config routes', async () => {
      expect((await request(build([])).get('/admin/config')).status).toBe(403);
      expect(
        (
          await request(build([]))
            .put('/admin/config/scalar_docs')
            .send({ value: false })
        ).status,
      ).toBe(403);
    });

    it('lets an admin from ADMIN_EMAILS reach the admin config handlers', async () => {
      const response = await request(build(['u1@example.com'])).get(
        '/admin/config',
      );
      // Past requireAdmin the handler fails on the fake prisma (500); 401/403/404 would mean it is not wired.
      expect(response.status).toBe(500);
    });
  });

  describe('campaigns, notifications and background consumers', () => {
    const calls: string[] = [];
    const fakeQueue: QueueInterface = {
      start: async () => void calls.push('start'),
      stop: async () => void calls.push('stop'),
      consumeSendEmail: async () => void calls.push('consumeSendEmail'),
      consumeNotify: async () => void calls.push('consumeNotify'),
      publishSendEmail: async () => undefined,
      publishNotify: async () => undefined,
    };
    const fakeRedis = {
      publish: async (): Promise<number> => 0,
      subscribe: async (): Promise<unknown> => undefined,
      unsubscribe: async (): Promise<unknown> => undefined,
      on: (): unknown => undefined,
    };
    const fakeAuth = (
      req: Request,
      res: Response,
      next: NextFunction,
    ): void => {
      req.user = { id: 'u1', email: 'u1@example.com', role: 'user' };
      res.locals.userId = 'u1';
      next();
    };
    const application = buildApplication({
      env,
      prisma: {} as PrismaClient,
      requireAuth: fakeAuth,
      queue: fakeQueue,
      storage: { ensureBucket: async () => undefined } as never,
      redis: { publisher: fakeRedis, subscriber: fakeRedis },
    });

    it.each([
      ['get', '/projects/p1/campaigns'],
      ['get', '/projects/p1/campaigns/c1/recipients'],
      ['post', '/projects/p1/campaigns/c1/send'],
      ['get', '/projects/p1/notifications'],
    ] as const)('requires authentication for %s %s', async (method, path) => {
      expect((await request(app)[method](path)).status).toBe(401);
    });

    it.each([
      ['get', '/projects/p1/campaigns'],
      ['get', '/projects/p1/campaigns/c1/recipients'],
      ['post', '/projects/p1/campaigns/c1/send'],
      ['get', '/projects/p1/notifications'],
    ] as const)('mounts %s %s', async (method, path) => {
      const response = await request(application.app)[method](path).send({});
      expect([400, 500]).toContain(response.status);
    });

    it('does not apply the admin-only guard to routes mounted after the admin config router', async () => {
      // Regression: requireAdmin used to block every router mounted after /admin/config for non-admins.
      const response = await request(application.app).get('/projects');
      expect([400, 500]).toContain(response.status);
    });

    it('start() starts the queue and registers both consumers; stop() stops it', async () => {
      calls.length = 0;
      await application.start();
      expect(calls).toEqual(
        expect.arrayContaining(['start', 'consumeSendEmail', 'consumeNotify']),
      );
      expect(calls.indexOf('start')).toBeLessThan(
        calls.indexOf('consumeSendEmail'),
      );
      await application.stop();
      expect(calls).toContain('stop');
    });
  });

  describe('PDF templates behind the pdf_builder feature flag', () => {
    const fakeRedis = {
      publish: async (): Promise<number> => 0,
      subscribe: async (): Promise<unknown> => undefined,
      unsubscribe: async (): Promise<unknown> => undefined,
      on: (): unknown => undefined,
    };
    const fakeAuth = (
      req: Request,
      res: Response,
      next: NextFunction,
    ): void => {
      req.user = { id: 'u1', email: 'u1@example.com', role: 'user' };
      res.locals.userId = 'u1';
      next();
    };
    const build = (enabled: boolean): ReturnType<typeof buildApp> =>
      buildApp({
        env,
        prisma: {} as PrismaClient,
        requireAuth: fakeAuth,
        redis: { publisher: fakeRedis, subscriber: fakeRedis },
        flags: { isEnabled: async () => enabled } as never,
      });

    it('requires authentication', async () => {
      expect(
        (await request(app).get('/projects/p1/pdf-templates')).status,
      ).toBe(401);
    });

    it('returns 404 while the flag is off', async () => {
      expect(
        (await request(build(false)).get('/projects/p1/pdf-templates')).status,
      ).toBe(404);
    });

    it('mounts the routes while the flag is on', async () => {
      const response = await request(build(true)).get(
        '/projects/p1/pdf-templates',
      );
      expect([400, 500]).toContain(response.status);
    });

    it('does not let the flag affect other routes', async () => {
      const response = await request(build(false)).get('/projects');
      expect([400, 500]).toContain(response.status);
    });
  });

  describe('metrics and API docs', () => {
    const fakeRedis = {
      publish: async (): Promise<number> => 0,
      subscribe: async (): Promise<unknown> => undefined,
      unsubscribe: async (): Promise<unknown> => undefined,
      on: (): unknown => undefined,
    };
    const fakeAuth = (
      req: Request,
      res: Response,
      next: NextFunction,
    ): void => {
      req.user = { id: 'u1', email: 'u1@example.com', role: 'user' };
      res.locals.userId = 'u1';
      next();
    };
    const build = (
      options: {
        metricsToken?: string;
        docsEnabled?: boolean;
        signedIn?: boolean;
      } = {},
    ): ReturnType<typeof buildApp> =>
      buildApp({
        env: { ...env, METRICS_TOKEN: options.metricsToken },
        prisma: {} as PrismaClient,
        ...(options.signedIn === false ? {} : { requireAuth: fakeAuth }),
        redis: { publisher: fakeRedis, subscriber: fakeRedis },
        flags: { isEnabled: async () => options.docsEnabled ?? true } as never,
      });

    it('records requests by route pattern and exposes them at /metrics', async () => {
      const app = build();
      await request(app).get('/health');
      const response = await request(app).get('/metrics');
      expect(response.status).toBe(200);
      expect(response.text).toContain('slipakar_http_requests_total');
      expect(response.text).toContain('route="/health"');
    });

    it('requires the bearer token on /metrics when METRICS_TOKEN is set', async () => {
      const token = 'metrics-token-1234567890';
      const app = build({ metricsToken: token });
      expect((await request(app).get('/metrics')).status).toBe(401);
      expect(
        (
          await request(app)
            .get('/metrics')
            .set('Authorization', 'Bearer wrong-token-0000000000')
        ).status,
      ).toBe(401);
      expect(
        (
          await request(app)
            .get('/metrics')
            .set('Authorization', `Bearer ${token}`)
        ).status,
      ).toBe(200);
    });

    it.each(['/openapi.json', '/docs'])(
      'requires sign-in for %s',
      async (path) => {
        expect(
          (await request(build({ signedIn: false })).get(path)).status,
        ).toBe(401);
      },
    );

    it.each(['/openapi.json', '/docs'])(
      'hides %s while the scalar_docs flag is off',
      async (path) => {
        expect(
          (await request(build({ docsEnabled: false })).get(path)).status,
        ).toBe(404);
      },
    );

    it('serves the OpenAPI document while the flag is on', async () => {
      const response = await request(build()).get('/openapi.json');
      expect(response.status).toBe(200);
      expect(response.body.openapi).toBe('3.1.0');
      expect(Object.keys(response.body.paths).length).toBeGreaterThan(10);
    });

    it('serves the Scalar page while the flag is on', async () => {
      const response = await request(build()).get('/docs');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
    });

    it('keeps the docs flag from affecting other routes', async () => {
      const response = await request(build({ docsEnabled: false })).get(
        '/projects',
      );
      expect([400, 500]).toContain(response.status);
    });
  });
});

describe('error reporting wiring', () => {
  it('reports unexpected request errors to the error reporter and flushes the log on stop', async () => {
    const captured: unknown[][] = [];
    let stopped = false;
    const application = buildApplication({
      env,
      prisma: {} as PrismaClient,
      requireAuth: () => { throw new Error('boom'); },
      errorReporter: { capture: (...args) => { captured.push(args); } },
      errorLogSink: { record: () => undefined, flush: async () => undefined, start: () => undefined, stop: async () => { stopped = true; } },
      storage: { ensureBucket: async () => undefined } as never,
      queue: { start: async () => undefined, stop: async () => undefined, consumeSendEmail: async () => undefined, consumeNotify: async () => undefined } as never,
      flags: { start: async () => undefined, stop: async () => undefined, isEnabled: async () => true, notifyChanged: async () => undefined } as never,
    });
    const response = await request(application.app).get('/projects');
    expect(response.status).toBe(500);
    expect(captured).toHaveLength(1);
    await application.stop();
    expect(stopped).toBe(true);
  });
});
