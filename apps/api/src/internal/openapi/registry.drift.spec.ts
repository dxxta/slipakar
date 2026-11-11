import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../composition.js';
import { allRouteDocs } from './routes/index.js';

const ignoredPaths = ['/health', '/docs', '/openapi.json', '/integrations/docs', '/integrations/openapi.json', '/metrics', '/embed/exchange'];

const env = {
  DATABASE_URL: 'postgresql://localhost/db',
  APP_ENCRYPTION_KEY: 'a'.repeat(64),
  GOOGLE_CLIENT_ID: 'google-id',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  BETTER_AUTH_SECRET: 'auth-secret',
  BETTER_AUTH_URL: 'http://localhost:3000',
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

describe('OpenAPI route registry drift test', () => {
  it('matches all real routes registered in Express buildApp against allRouteDocs', () => {
    const fakeRedis = {
      publish: async (): Promise<number> => 0,
      subscribe: async (): Promise<unknown> => undefined,
      unsubscribe: async (): Promise<unknown> => undefined,
      on: (): unknown => undefined,
    };

    const app = buildApp({
      env,
      prisma: {} as PrismaClient,
      flags: { isEnabled: async () => true } as never,
      redis: { publisher: fakeRedis, subscriber: fakeRedis },
      storage: { ensureBucket: async () => undefined } as never,
      queue: {
        start: async () => undefined,
        stop: async () => undefined,
        publishSendEmail: async () => undefined,
        publishNotify: async () => undefined,
        consumeSendEmail: async () => undefined,
        consumeNotify: async () => undefined,
      },
    });

    const realRoutes: Array<{ method: string; path: string }> = [];

    // Walk Express 5 router
    function walkRouter(router: { stack: Array<{ route?: { path: string; methods: Record<string, boolean> }; handle?: { stack?: unknown[] } }> }, prefix = ''): void {
      for (const layer of router.stack) {
        if (layer.route) {
          const path = prefix + layer.route.path;
          for (const [method, enabled] of Object.entries(layer.route.methods)) {
            if (enabled) {
              realRoutes.push({ method: method.toLowerCase(), path });
            }
          }
        } else if (layer.handle && 'stack' in layer.handle && Array.isArray(layer.handle.stack)) {
          walkRouter(layer.handle as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> }; handle?: { stack?: unknown[] } }> }, prefix);
        }
      }
    }

    const appAny = app as unknown as { router: { stack: Array<{ route?: { path: string; methods: Record<string, boolean> }; handle?: { stack?: unknown[] } }> } };
    walkRouter(appAny.router);

    // Filter out ignored paths
    const filteredRealRoutes = realRoutes
      .filter((r) => !ignoredPaths.includes(r.path) && !r.path.startsWith('/api/auth/'))
      .map((r) => `${r.method.toUpperCase()} ${r.path}`)
      .sort();

    const registeredDocRoutes = allRouteDocs
      .map((r) => `${r.method.toUpperCase()} ${r.path}`)
      .sort();

    // Check for real routes missing from docs
    const missingFromDocs = filteredRealRoutes.filter((r) => !registeredDocRoutes.includes(r));
    // Check for documented routes that are not in real app
    const missingFromApp = registeredDocRoutes.filter((r) => !filteredRealRoutes.includes(r));

    expect(missingFromDocs, `Routes in real app but missing from allRouteDocs: ${JSON.stringify(missingFromDocs)}`).toEqual([]);
    expect(missingFromApp, `Routes in allRouteDocs but missing from real app: ${JSON.stringify(missingFromApp)}`).toEqual([]);
    expect(registeredDocRoutes).toEqual(filteredRealRoutes);
  });
});
