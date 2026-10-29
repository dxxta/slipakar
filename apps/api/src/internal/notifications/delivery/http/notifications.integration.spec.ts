import { startContainer } from '../../../../test-support/start-container.js';
import { execFileSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorHandler } from '../../../../middleware/error-handler.js';
import { buildAuditRepository } from '../../../audit/repository/audit.js';
import { buildNotificationsRepository } from '../../repository/notifications.js';
import { buildNotificationsUseCase } from '../../usecase/notifications.js';
import { createNotificationsRouter } from './notifications.js';

describe('Notifications HTTP integration', () => {
  let pgContainer: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let app: express.Express;
  let myProjectId: string;
  let otherProjectId: string;
  let useCase: ReturnType<typeof buildNotificationsUseCase>;

  beforeAll(async () => {
    pgContainer = await startContainer(() => new PostgreSqlContainer('postgres:16').start());
    const pgConn = pgContainer.getConnectionUri();

    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--config', 'apps/api/prisma.config.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: pgConn },
      stdio: 'pipe',
    });

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: pgConn }) });

    const owner = await prisma.user.create({ data: { email: 'owner@example.com', name: 'Owner' } });
    const otherUser = await prisma.user.create({ data: { email: 'other@example.com', name: 'Other' } });

    const myProj = await prisma.project.create({ data: { ownerId: owner.id, name: 'My Proj' } });
    const otherProj = await prisma.project.create({ data: { ownerId: otherUser.id, name: 'Other Proj' } });
    myProjectId = myProj.id;
    otherProjectId = otherProj.id;

    const repository = buildNotificationsRepository({
      prisma,
      auditRepository: buildAuditRepository(prisma),
    });

    useCase = buildNotificationsUseCase({
      repository,
      prisma,
      projectLookup: async (pId, uId) => {
        const found = await prisma.project.findFirst({ where: { id: pId, ownerId: uId } });
        return found !== null;
      },
    });

    app = express();
    app.use(express.json());
    app.use(
      createNotificationsRouter({
        guards: [
          (_req, res, next) => {
            res.locals.userId = owner.id;
            next();
          },
        ],
        useCase,
      }),
    );
    app.use(errorHandler);
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await pgContainer?.stop();
  }, 120_000);

  it('handleNotify persists, list is paginated and newest first, another users project gives 404', async () => {
    // 1. handleNotify persists 2 notifications
    await useCase.handleNotify({
      type: 'send_failed',
      projectId: myProjectId,
      campaignId: null,
      message: 'First notification',
    });
    // Brief sleep to ensure distinct createdAt timestamps
    await new Promise((resolve) => setTimeout(resolve, 50));
    await useCase.handleNotify({
      type: 'campaign_finished',
      projectId: myProjectId,
      campaignId: null,
      message: 'Second notification',
    });

    // 2. list is paginated and newest first
    const res = await request(app).get(`/projects/${myProjectId}/notifications?page=1&limit=10`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].message).toBe('Second notification');
    expect(res.body.data[1].message).toBe('First notification');
    expect(res.body.data[0].readAt).toBeNull();
    expect(res.body.data[0].createdAt).toEqual(expect.any(String));
    expect(res.body.metadata).toMatchObject({ page: 1, limit: 10, total: 2 });

    // 3. Another user's project gives 404
    const otherRes = await request(app).get(`/projects/${otherProjectId}/notifications?page=1&limit=10`);
    expect(otherRes.status).toBe(404);
    expect(otherRes.body.error.code).toBe('NOT_FOUND');
  });

  it('marks notifications read idempotently, filters unread, audits writes, and scopes counts to owned projects', async () => {
    const clearPreviousUnread = await request(app).post(`/projects/${myProjectId}/notifications/read-all`);
    expect(clearPreviousUnread.status).toBe(200);
    const first = await prisma.notification.create({
      data: { projectId: myProjectId, type: 'send_failed', message: 'First unread' },
    });
    const second = await prisma.notification.create({
      data: { projectId: myProjectId, type: 'campaign_finished', message: 'Second unread' },
    });
    await prisma.notification.create({
      data: { projectId: otherProjectId, type: 'send_failed', message: 'Other owner unread' },
    });

    const initialCount = await request(app).get('/notifications/unread-count');
    expect(initialCount.status).toBe(200);
    expect(initialCount.body.data).toEqual({ count: 2 });

    const marked = await request(app).post(`/projects/${myProjectId}/notifications/${first.id}/read`);
    expect(marked.status).toBe(200);
    expect(marked.body.data.readAt).toEqual(expect.any(String));
    const originalReadAt = marked.body.data.readAt as string;

    const markedAgain = await request(app).post(`/projects/${myProjectId}/notifications/${first.id}/read`);
    expect(markedAgain.body.data.readAt).toBe(originalReadAt);

    const unreadList = await request(app).get(`/projects/${myProjectId}/notifications?unread=true`);
    expect(unreadList.status).toBe(200);
    expect(unreadList.body.data.map((notification: { id: string }) => notification.id)).toEqual([second.id]);

    const invalidUnread = await request(app).get(`/projects/${myProjectId}/notifications?unread=yes`);
    expect(invalidUnread.status).toBe(400);
    expect(invalidUnread.body.error.code).toBe('VALIDATION');

    const readAll = await request(app).post(`/projects/${myProjectId}/notifications/read-all`);
    expect(readAll.status).toBe(200);
    expect(readAll.body.data).toEqual({ count: 1 });

    const finalCount = await request(app).get('/notifications/unread-count');
    expect(finalCount.body.data).toEqual({ count: 0 });

    const audits = await prisma.auditLog.findMany({
      where: { entity: 'Notification', entityId: { in: [first.id, second.id] }, action: 'update' },
    });
    expect(audits).toHaveLength(2);

    const foreignRead = await request(app).post(`/projects/${otherProjectId}/notifications/${first.id}/read`);
    expect(foreignRead.status).toBe(404);
    const foreignReadAll = await request(app).post(`/projects/${otherProjectId}/notifications/read-all`);
    expect(foreignReadAll.status).toBe(404);
    const missingRead = await request(app).post(`/projects/${myProjectId}/notifications/unknown-notification/read`);
    expect(missingRead.status).toBe(404);
    expect(missingRead.body.error.code).toBe('NOT_FOUND');
  });
});
