import { startContainer } from '../../../../test-support/start-container.js';
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { PrismaClient } from '@prisma/client';
import express from 'express';
import request from 'supertest';
import { UserNoticesRepository } from '../../repository/user-notices.js';
import { UserNoticesUseCase } from '../../usecase/user-notices.js';
import { createUserNoticesRouter } from './user-notices.js';

describe('UserNotices HTTP integration', () => {
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
        email: 'noticetest@example.com',
        name: 'Notice Test',
      },
    });
    testUserId = user.id;

    // Create 2 notices
    await prisma.userNotice.createMany({
      data: [
        {
          userId: testUserId,
          title: 'Welcome',
          message: 'Welcome to Slipakar!',
        },
        {
          userId: testUserId,
          title: 'Update',
          message: 'System updated.',
        },
      ],
    });

    const repo = new UserNoticesRepository(prisma);
    const useCase = new UserNoticesUseCase(repo);

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      res.locals.userId = testUserId;
      next();
    });
    app.use(createUserNoticesRouter({ userGuards: [], useCase }));
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  it('lists notices, gets unread count, and marks notice read', async () => {
    // 1. List
    const listRes = await request(app).get('/me/notices');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(2);

    // 2. Unread count
    const unreadRes = await request(app).get('/me/notices/unread-count');
    expect(unreadRes.status).toBe(200);
    expect(unreadRes.body.data.unreadCount).toBe(2);

    // 3. Mark one read
    const noticeId = listRes.body.data[0].id;
    const markRes = await request(app).patch(`/me/notices/${noticeId}/read`);
    expect(markRes.status).toBe(200);
    expect(markRes.body.data.readAt).not.toBeNull();

    // 4. Unread count is now 1
    const unreadAfter = await request(app).get('/me/notices/unread-count');
    expect(unreadAfter.body.data.unreadCount).toBe(1);

    // 5. Mark all read
    const markAllRes = await request(app).post('/me/notices/mark-all-read');
    expect(markAllRes.status).toBe(200);
    expect(markAllRes.body.data.updatedCount).toBe(1);
  });
});
