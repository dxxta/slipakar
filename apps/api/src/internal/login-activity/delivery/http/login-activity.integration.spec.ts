import { startContainer } from '../../../../test-support/start-container.js';
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { PrismaClient } from '@prisma/client';
import express from 'express';
import request from 'supertest';
import { LoginActivityRepository } from '../../repository/login-activity.js';
import { LoginActivityUseCase } from '../../usecase/login-activity.js';
import { createLoginActivityRouter } from './login-activity.js';

describe('LoginActivity HTTP integration', () => {
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
        email: 'logintest@example.com',
        name: 'Login Test',
      },
    });
    testUserId = user.id;

    const repo = new LoginActivityRepository(prisma);
    const useCase = new LoginActivityUseCase(repo, 90);

    // Pre-seed some events
    await repo.create({
      userId: testUserId,
      ipAddress: '8.8.8.8',
      proxy: false,
      browser: 'Chrome',
      os: 'macOS',
      deviceType: 'desktop',
      country: 'US',
      city: 'Mountain View',
    });

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      res.locals.userId = testUserId;
      next();
    });
    app.use(
      createLoginActivityRouter({
        userGuards: [],
        adminGuards: [],
        useCase,
      }),
    );
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  it('GET /me/login-activity returns own login events with pagination', async () => {
    const res = await request(app).get('/me/login-activity');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].userId).toBe(testUserId);
    expect(res.body.metadata.total).toBeGreaterThanOrEqual(1);
  });

  it('GET /admin/login-activity returns all user login events including user details', async () => {
    const res = await request(app).get('/admin/login-activity');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].userEmail).toBe('logintest@example.com');
  });
});
