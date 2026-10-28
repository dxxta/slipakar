import { startContainer } from '../../../../test-support/start-container.js';
import { execFileSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StorageInterface } from '../../../../domain/storage/interface.js';
import { errorHandler } from '../../../../middleware/error-handler.js';
import { buildAuditRepository } from '../../../audit/repository/audit.js';
import { buildAttachmentsRepository } from '../../repository/attachments.js';
import { buildAttachmentsUseCase } from '../../usecase/attachments.js';
import { createAttachmentsRouter } from './attachments.js';

describe('clean architecture attachments API integration', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let app: express.Express;
  let projectId: string;

  // Fake in-memory storage object
  const storageMap = new Map<string, Buffer>();
  const fakeStorage: StorageInterface = {
    async ensureBucket(): Promise<void> {},
    async putObject({ key, body }): Promise<void> {
      storageMap.set(key, body);
    },
    async getObject(key: string): Promise<Buffer> {
      const found = storageMap.get(key);
      if (!found) {
        throw new Error('NotFound');
      }
      return found;
    },
    async deleteObject(key: string): Promise<void> {
      storageMap.delete(key);
    },
    async objectExists(key: string): Promise<boolean> {
      return storageMap.has(key);
    },
  };

  beforeAll(async () => {
    container = await startContainer(() => new PostgreSqlContainer('postgres:16').start());
    const connectionString = container.getConnectionUri();
    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--config', 'apps/api/prisma.config.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: connectionString },
      stdio: 'pipe',
    });
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    const owner = await prisma.user.create({ data: { email: 'attachment-owner@example.com', name: 'Owner' } });

    // 10_000 bytes quota for predictable testing
    projectId = (await prisma.project.create({
      data: { ownerId: owner.id, name: 'Attachments Project', storageQuotaBytes: 10_000n },
    })).id;

    const projectLookup = async (id: string, userId: string): Promise<boolean> =>
      (await prisma.project.findFirst({ where: { id, ownerId: userId } })) !== null;

    const quotaLookup = async (id: string, userId: string): Promise<{ storageQuotaBytes: bigint } | null> => {
      const proj = await prisma.project.findFirst({
        where: { id, ownerId: userId },
        select: { storageQuotaBytes: true },
      });
      return proj ? { storageQuotaBytes: proj.storageQuotaBytes } : null;
    };

    const useCase = buildAttachmentsUseCase({
      repository: buildAttachmentsRepository({ prisma, auditRepository: buildAuditRepository(prisma) }),
      prisma,
      storage: fakeStorage,
      projectLookup,
      quotaLookup,
    });

    app = express();
    app.use(createAttachmentsRouter({
      useCase,
      guards: [
        (req, res, next) => {
          req.user = { id: owner.id, email: owner.email, role: owner.role };
          res.locals.userId = owner.id;
          next();
        },
      ],
    }));
    app.use(errorHandler);
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  it('upload then list then usage then delete then usage back to 0; JSON response never contains objectKey', async () => {
    const fileContent = Buffer.from('hello attachment content');
    const uploadRes = await request(app)
      .post(`/projects/${projectId}/attachments`)
      .field('kind', 'extra')
      .attach('file', fileContent, 'test-doc.pdf');

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body).toMatchObject({
      message: 'Attachment created successfully',
      success: true,
      data: {
        fileName: 'test-doc.pdf',
        sizeBytes: String(fileContent.length),
        kind: 'extra',
      },
    });
    expect(JSON.stringify(uploadRes.body)).not.toContain('objectKey');
    expect(uploadRes.body.data).not.toHaveProperty('objectKey');

    const attachmentId = uploadRes.body.data.id as string;

    // List attachments
    const listRes = await request(app).get(`/projects/${projectId}/attachments`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].id).toBe(attachmentId);
    expect(JSON.stringify(listRes.body)).not.toContain('objectKey');

    // Storage usage
    const usageRes = await request(app).get(`/projects/${projectId}/storage`);
    expect(usageRes.status).toBe(200);
    expect(usageRes.body.data).toEqual({
      usedBytes: String(fileContent.length),
      quotaBytes: '10000',
    });

    // Delete attachment
    const deleteRes = await request(app).delete(`/projects/${projectId}/attachments/${attachmentId}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body).toEqual({
      message: 'Attachment deleted successfully',
      data: null,
      success: true,
    });

    // Storage usage back to 0
    const usageAfterDelete = await request(app).get(`/projects/${projectId}/storage`);
    expect(usageAfterDelete.status).toBe(200);
    expect(usageAfterDelete.body.data.usedBytes).toBe('0');
  });

  it('TWO PARALLEL uploads each 60 percent of the quota result in exactly one 201 and one 413', async () => {
    // Current usage is 0, quota is 10,000. 60% of quota = 6,000 bytes.
    const file60Percent = Buffer.alloc(6000, 'x');

    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/projects/${projectId}/attachments`)
        .attach('file', file60Percent, 'parallel-1.bin'),
      request(app)
        .post(`/projects/${projectId}/attachments`)
        .attach('file', file60Percent, 'parallel-2.bin'),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 413]);

    const failedRes = res1.status === 413 ? res1 : res2;
    expect(failedRes.body.error.code).toBe('STORAGE_QUOTA_EXCEEDED');

    // Cleanup: verify total used is exactly 6000 bytes
    const usageRes = await request(app).get(`/projects/${projectId}/storage`);
    expect(usageRes.body.data.usedBytes).toBe('6000');
  });

  it('supports uploading attachment with campaignId and querying GET with ?campaignId=', async () => {
    // Create a campaign
    const emailTemplate = await prisma.emailTemplate.create({
      data: { projectId, name: 'Template 1', subject: 'Subject', bodyHtml: '<p>Body</p>' },
    });
    const smtpConn = await prisma.smtpConnection.create({
      data: { projectId, host: 'smtp.test', port: 587, secure: false, username: 'user', passwordEncrypted: 'enc' },
    });
    const upload = await prisma.dataUpload.create({
      data: { projectId, fileName: 'data.csv', columns: ['email'], rows: [{ email: 'a@b.com' }], rowCount: 1 },
    });
    const campaign = await prisma.campaign.create({
      data: {
        projectId,
        emailTemplateId: emailTemplate.id,
        smtpConnectionId: smtpConn.id,
        uploadId: upload.id,
        emailColumn: 'email',
      },
    });

    // Upload attachment attached to campaign
    const uploadRes = await request(app)
      .post(`/projects/${projectId}/attachments`)
      .field('campaignId', campaign.id)
      .attach('file', Buffer.from('campaign doc'), 'camp-doc.pdf');
    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.data.campaignId).toBe(campaign.id);

    // List filtered by campaignId
    const listFiltered = await request(app).get(`/projects/${projectId}/attachments?campaignId=${campaign.id}`);
    expect(listFiltered.status).toBe(200);
    expect(listFiltered.body.data.length).toBeGreaterThanOrEqual(1);
    expect(listFiltered.body.data.every((a: { campaignId: string }) => a.campaignId === campaign.id)).toBe(true);

    // Upload with non-existent campaignId gives 404
    const nonExistentCampaignId = '00000000-0000-0000-0000-000000000000';
    const badRes = await request(app)
      .post(`/projects/${projectId}/attachments`)
      .field('campaignId', nonExistentCampaignId)
      .attach('file', Buffer.from('bad doc'), 'bad.pdf');
    expect(badRes.status).toBe(404);
    expect(badRes.body.error.code).toBe('NOT_FOUND');
  });
});
