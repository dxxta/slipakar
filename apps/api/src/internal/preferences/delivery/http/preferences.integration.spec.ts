import { startContainer } from '../../../../test-support/start-container.js';
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { PrismaClient } from '@prisma/client';
import express from 'express';
import request from 'supertest';
import { PreferencesRepository } from '../../repository/preferences.js';
import { PreferencesUseCase } from '../../usecase/preferences.js';
import { createPreferencesRouter } from './preferences.js';
import { buildAuditRepository } from '../../../audit/repository/audit.js';

describe('Preferences HTTP integration', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let app: express.Express;
  let testUserId: string;

  beforeAll(async () => {
    container = await startContainer(() => new PostgreSqlContainer('postgres:16').start());
    process.env.DATABASE_URL = container.getConnectionUri();

    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--config', 'apps/api/prisma.config.ts'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'pipe',
    });

    const { prisma: testPrisma } = await import('../../../../prisma/client.js');
    prisma = testPrisma;

    const user = await prisma.user.create({
      data: {
        email: 'preftest@example.com',
        name: 'Pref Test',
      },
    });
    testUserId = user.id;

    const auditRepo = buildAuditRepository(prisma);
    const prefRepo = new PreferencesRepository(prisma, auditRepo);
    const prefUseCase = new PreferencesUseCase(prefRepo);

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      res.locals.userId = testUserId;
      next();
    });
    app.use(createPreferencesRouter({ guards: [], preferencesUseCase: prefUseCase }));
    app.use((err: Error & { status?: number }, _req: express.Request, res: express.Response) => {
      res.status(err.status ?? 500).json({ error: err.message });
    });
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  it('gets default preferences', async () => {
    const res = await request(app).get('/me/preferences');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      themeMode: 'system',
      themeAccent: 'slate',
    });
  });

  it('updates preferences and records audit logs', async () => {
    const res = await request(app)
      .patch('/me/preferences')
      .send({ themeMode: 'dark', themeAccent: 'amber' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      themeMode: 'dark',
      themeAccent: 'amber',
    });

    // Check DB state
    const user = await prisma.user.findUniqueOrThrow({ where: { id: testUserId } });
    expect(user.themeMode).toBe('dark');
    expect(user.themeAccent).toBe('amber');

    // Check audit rows
    const logs = await prisma.auditLog.findMany({
      where: { entity: 'User', entityId: testUserId },
    });
    expect(logs.some((l) => l.fieldName === 'themeMode')).toBe(true);
    expect(logs.some((l) => l.fieldName === 'themeAccent')).toBe(true);
  });
});
