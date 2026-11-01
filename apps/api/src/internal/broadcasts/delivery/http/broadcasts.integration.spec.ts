import { startContainer } from '../../../../test-support/start-container.js';
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { PrismaClient } from '@prisma/client';
import express from 'express';
import request from 'supertest';
import { BroadcastRepository } from '../../repository/broadcasts.js';
import { BroadcastUseCase } from '../../usecase/broadcasts.js';
import { createBroadcastsRouter } from './broadcasts.js';
import { buildAuditRepository } from '../../../audit/repository/audit.js';

describe('Broadcasts HTTP integration', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let app: express.Express;
  let adminUserId: string;

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

    const admin = await prisma.user.create({
      data: {
        email: 'adminbc@example.com',
        name: 'Admin BC',
        role: 'admin',
      },
    });
    adminUserId = admin.id;

    // Create 2 normal users
    await prisma.user.createMany({
      data: [
        { email: 'u1@example.com', name: 'User 1' },
        { email: 'u2@example.com', name: 'User 2' },
      ],
    });

    const auditRepo = buildAuditRepository(prisma);
    const repo = new BroadcastRepository(prisma, auditRepo);
    const useCase = new BroadcastUseCase(repo, auditRepo);

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      res.locals.userId = adminUserId;
      next();
    });
    app.use(createBroadcastsRouter({ adminGuards: [], useCase }));
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  it('creates, previews, and sends a broadcast', async () => {
    // 1. Create
    const createRes = await request(app)
      .post('/admin/broadcasts')
      .send({
        subject: 'Scheduled Maintenance',
        bodyText: 'We will be updating servers tonight.',
        audience: 'all',
      });
    expect(createRes.status).toBe(201);
    const broadcastId = createRes.body.data.id;
    expect(createRes.body.data.status).toBe('draft');

    // 2. Preview
    const previewRes = await request(app).post(`/admin/broadcasts/${broadcastId}/preview`);
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.data.recipientCount).toBeGreaterThanOrEqual(3);
    expect(previewRes.body.data.sampleEmails.length).toBeGreaterThanOrEqual(1);

    // 3. Send
    const sendRes = await request(app).post(`/admin/broadcasts/${broadcastId}/send`);
    expect(sendRes.status).toBe(200);
    expect(sendRes.body.data.status).toBe('sent');
    expect(sendRes.body.data.counts.total).toBeGreaterThanOrEqual(3);

    // Verify UserNotices created in DB
    const notices = await prisma.userNotice.findMany({
      where: { broadcastId },
    });
    expect(notices.length).toBeGreaterThanOrEqual(3);

    // 4. Sending again returns 409
    const secondSendRes = await request(app).post(`/admin/broadcasts/${broadcastId}/send`);
    expect(secondSendRes.status).toBe(409);
  });
});
