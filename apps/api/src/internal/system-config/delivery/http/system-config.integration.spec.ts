import { startContainer } from '../../../../test-support/start-container.js';
import { execFileSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import express from 'express';
import { Redis } from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorHandler } from '../../../../middleware/error-handler.js';
import { buildAuditRepository } from '../../../audit/repository/audit.js';
import { requireAdmin } from '../../middleware/require-admin.js';
import { buildFeatureFlags } from '../../service/feature-flags.js';
import { buildSystemConfigRepository } from '../../repository/system-config.js';
import { buildSystemConfigUseCase } from '../../usecase/system-config.js';
import { createSystemConfigRouter } from './system-config.js';

describe('system config integration', () => {
  let pgContainer: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let prisma: PrismaClient;
  let app: express.Express;

  let redisPubA: Redis;
  let redisSubA: Redis;
  let redisPubB: Redis;
  let redisSubB: Redis;

  let featureFlagsA: ReturnType<typeof buildFeatureFlags>;
  let featureFlagsB: ReturnType<typeof buildFeatureFlags>;
  let useCaseB: ReturnType<typeof buildSystemConfigUseCase>;

  const adminEmail = 'admin@example.com';
  const regularEmail = 'user@example.com';

  beforeAll(async () => {
    pgContainer = await startContainer(() => new PostgreSqlContainer('postgres:16').start());
    const pgConn = pgContainer.getConnectionUri();

    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--config', 'apps/api/prisma.config.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: pgConn },
      stdio: 'pipe',
    });

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: pgConn }) });

    redisContainer = await startContainer(() => new RedisContainer('redis:7').start());
    const redisUrl = redisContainer.getConnectionUrl();

    redisPubA = new Redis(redisUrl);
    redisSubA = new Redis(redisUrl);
    redisPubB = new Redis(redisUrl);
    redisSubB = new Redis(redisUrl);

    const repository = buildSystemConfigRepository({
      prisma,
      auditRepository: buildAuditRepository(prisma),
    });

    // Instance A with very long TTL (e.g. 1 hour)
    featureFlagsA = buildFeatureFlags({
      repository,
      publisher: redisPubA,
      subscriber: redisSubA,
      ttlMs: 3_600_000,
    });
    await featureFlagsA.start();

    // Instance B
    featureFlagsB = buildFeatureFlags({
      repository,
      publisher: redisPubB,
      subscriber: redisSubB,
      ttlMs: 3_600_000,
    });
    await featureFlagsB.start();

    useCaseB = buildSystemConfigUseCase({
      repository,
      prisma,
      flags: featureFlagsB,
      notifyChanged: (key) => featureFlagsB.notifyChanged(key),
    });

    app = express();
    app.use(express.json());
    app.use(
      createSystemConfigRouter({
        guards: [
          (req, res, next) => {
            const emailHeader = (req.headers['x-test-email'] as string) || adminEmail;
            req.user = { id: 'user-id-1', email: emailHeader, role: 'admin' };
            res.locals.userId = 'user-id-1';
            next();
          },
          requireAdmin([adminEmail]),
        ],
        useCase: useCaseB,
      }),
    );
    app.use(errorHandler);
  }, 120_000);

  afterAll(async () => {
    await featureFlagsA?.stop();
    await featureFlagsB?.stop();
    redisPubA?.disconnect();
    redisSubA?.disconnect();
    redisPubB?.disconnect();
    redisSubB?.disconnect();
    await prisma?.$disconnect();
    await redisContainer?.stop();
    await pgContainer?.stop();
  }, 120_000);

  it('pub/sub invalidation between instances A and B works across processes', async () => {
    // Both cache scalar_docs as true initially
    expect(await featureFlagsA.isEnabled('scalar_docs')).toBe(true);
    expect(await featureFlagsB.isEnabled('scalar_docs')).toBe(true);

    // Instance B updates scalar_docs to false through usecase
    await useCaseB.updateSystemConfigUseCase({
      key: 'scalar_docs',
      payload: { value: false },
      auditUserId: 'admin-1',
    });

    // Instance B should see false immediately
    expect(await featureFlagsB.isEnabled('scalar_docs')).toBe(false);

    // Instance A (using its own cache with very long TTL) sees false after pub/sub message arrives (poll up to 2 seconds)
    const start = Date.now();
    let instanceAValue = true;
    while (Date.now() - start < 2000) {
      instanceAValue = await featureFlagsA.isEnabled('scalar_docs');
      if (!instanceAValue) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(instanceAValue).toBe(false);
  });

  it('GET /admin/config returns four flags, non-admin gets 403 on PUT, and audit rows exist for update', async () => {
    // GET /admin/config over HTTP
    const getRes = await request(app).get('/admin/config').set('x-test-email', adminEmail);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toMatchObject({
      message: 'System config retrieved successfully',
      success: true,
      data: [
        { key: 'scalar_docs', value: false },
        { key: 'pdf_builder', value: true },
        { key: 'self_signup', value: true },
        { key: 'api_access_enabled', value: false },
      ],
    });

    // Non-admin gets 403 on PUT
    const putForbidden = await request(app)
      .put('/admin/config/pdf_builder')
      .set('x-test-email', regularEmail)
      .send({ value: false });
    expect(putForbidden.status).toBe(403);
    expect(putForbidden.body.error.code).toBe('FORBIDDEN');

    // Admin updates pdf_builder
    const putOk = await request(app)
      .put('/admin/config/pdf_builder')
      .set('x-test-email', adminEmail)
      .send({ value: false });
    expect(putOk.status).toBe(200);
    expect(putOk.body).toMatchObject({
      message: 'System config updated successfully',
      data: { key: 'pdf_builder', value: false },
      success: true,
    });

    // Verify audit rows exist
    const audits = await prisma.auditLog.findMany({
      where: { entity: 'SystemConfig', fieldName: 'value' },
    });
    expect(audits.length).toBeGreaterThanOrEqual(2);
  });
});
