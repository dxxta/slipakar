import { startContainer } from '../../../../test-support/start-container.js';
import { execFileSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { QueuePublisher, SendEmailMessage } from '../../../../domain/queue/interface.js';
import { errorHandler } from '../../../../middleware/error-handler.js';
import { buildAuditRepository } from '../../../audit/repository/audit.js';
import { buildCampaignsRepository } from '../../repository/campaigns.js';
import { buildCampaignsUseCase } from '../../usecase/campaigns.js';
import { createCampaignsRouter } from './campaigns.js';

describe('campaigns HTTP delivery and flow integration', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let app: express.Express;
  let projectId: string;
  let foreignProjectId: string;
  let templateId: string;
  let smtpId: string;
  let uploadId: string;

  const enqueuedMessages: SendEmailMessage[] = [];
  const fakeQueue: QueuePublisher = {
    async publishSendEmail(message: SendEmailMessage): Promise<void> {
      enqueuedMessages.push(message);
    },
    async publishNotify(): Promise<void> {},
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
    const owner = await prisma.user.create({ data: { email: 'camp-owner@example.com', name: 'Owner' } });
    const other = await prisma.user.create({ data: { email: 'camp-other@example.com', name: 'Other' } });

    projectId = (await prisma.project.create({ data: { ownerId: owner.id, name: 'Campaign Proj' } })).id;
    foreignProjectId = (await prisma.project.create({ data: { ownerId: other.id, name: 'Foreign Proj' } })).id;

    // Create supporting domain entities
    const tpl = await prisma.emailTemplate.create({
      data: {
        projectId,
        name: 'Payslip',
        subject: 'Pay for {{employee_name}}',
        bodyHtml: '<p>Amount: {{salary}}</p>',
      },
    });
    templateId = tpl.id;

    const smtp = await prisma.smtpConnection.create({
      data: {
        projectId,
        host: 'smtp.example.com',
        port: 587,
        username: 'user',
        passwordEncrypted: 'enc:pass',
        secure: false,
      },
    });
    smtpId = smtp.id;

    const up = await prisma.dataUpload.create({
      data: {
        projectId,
        fileName: 'data.csv',
        columns: ['emp_name', 'pay', 'work_email'],
        rows: [
          { emp_name: 'Alice', pay: '1000', work_email: 'alice@company.com' },
          { emp_name: 'Bob', pay: '1200', work_email: 'bob@company.com' },
        ],
        rowCount: 2,
      },
    });
    uploadId = up.id;

    const mapping = {
      employee_name: 'emp_name',
      salary: 'pay',
    };

    const projectLookup = async (id: string, userId: string): Promise<boolean> =>
      (await prisma.project.findFirst({ where: { id, ownerId: userId } })) !== null;

    const templateLookup = async (pId: string, id: string) => {
      const record = await prisma.emailTemplate.findFirst({ where: { projectId: pId, id } });
      return record ? { subject: record.subject, bodyHtml: record.bodyHtml } : null;
    };

    const smtpLookup = async (pId: string, id: string) => {
      const record = await prisma.smtpConnection.findFirst({ where: { projectId: pId, id } });
      return record ? { id: record.id } : null;
    };

    const uploadLookup = async (pId: string, id: string) => {
      const record = await prisma.dataUpload.findFirst({ where: { projectId: pId, id } });
      return record ? { columns: record.columns as string[], rows: record.rows as Record<string, string>[] } : null;
    };

    const mappingLookup = async () => mapping;

    const useCase = buildCampaignsUseCase({
      repository: buildCampaignsRepository({ prisma, auditRepository: buildAuditRepository(prisma) }),
      prisma,
      queue: fakeQueue,
      templateLookup,
      smtpLookup,
      uploadLookup,
      mappingLookup,
      projectLookup,
    });

    app = express();
    app.use(express.json());
    app.use(createCampaignsRouter({
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

  it('create campaign, send returns 202 with N messages, second send gives 409', async () => {
    enqueuedMessages.length = 0;

    // 1. Create campaign
    const createRes = await request(app)
      .post(`/projects/${projectId}/campaigns`)
      .send({
        emailTemplateId: templateId,
        smtpConnectionId: smtpId,
        uploadId,
        emailColumn: 'work_email',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({
      message: 'Campaign created successfully',
      success: true,
      data: { status: 'draft' },
    });

    const campaignId = createRes.body.data.id as string;

    // Check recipients were created
    const recipientsRes = await request(app).get(`/projects/${projectId}/campaigns/${campaignId}/recipients`);
    expect(recipientsRes.status).toBe(200);
    expect(recipientsRes.body.data).toHaveLength(2);
    expect(recipientsRes.body.metadata.total).toBe(2);

    // 2. Trigger send returns 202 with enqueuedCount = 2
    const sendRes = await request(app).post(`/projects/${projectId}/campaigns/${campaignId}/send`);
    expect(sendRes.status).toBe(202);
    expect(sendRes.body.data).toMatchObject({
      campaignId,
      status: 'sending',
      enqueuedCount: 2,
    });
    expect(enqueuedMessages).toHaveLength(2);

    // 3. Second send gives 409 CAMPAIGN_ALREADY_SENT
    const secondSend = await request(app).post(`/projects/${projectId}/campaigns/${campaignId}/send`);
    expect(secondSend.status).toBe(409);
    expect(secondSend.body.error.code).toBe('CAMPAIGN_ALREADY_SENT');
  });

  it('TWO PARALLEL sends give exactly one 202 and one 409', async () => {
    // Create another draft campaign
    const createRes = await request(app)
      .post(`/projects/${projectId}/campaigns`)
      .send({
        emailTemplateId: templateId,
        smtpConnectionId: smtpId,
        uploadId,
        emailColumn: 'work_email',
      });
    const campaignId = createRes.body.data.id as string;

    const [send1, send2] = await Promise.all([
      request(app).post(`/projects/${projectId}/campaigns/${campaignId}/send`),
      request(app).post(`/projects/${projectId}/campaigns/${campaignId}/send`),
    ]);

    const statuses = [send1.status, send2.status].sort();
    expect(statuses).toEqual([202, 409]);
  });

  it('recipients pagination, status filter and retry flow', async () => {
    // Create a campaign and simulate a recipient failure
    const createRes = await request(app)
      .post(`/projects/${projectId}/campaigns`)
      .send({
        emailTemplateId: templateId,
        smtpConnectionId: smtpId,
        uploadId,
        emailColumn: 'work_email',
      });
    const campaignId = createRes.body.data.id as string;

    const recipientsList = await request(app).get(`/projects/${projectId}/campaigns/${campaignId}/recipients?limit=1&page=1`);
    expect(recipientsList.status).toBe(200);
    expect(recipientsList.body.data).toHaveLength(1);
    expect(recipientsList.body.metadata.total).toBe(2);

    const firstRecipientId = recipientsList.body.data[0].id as string;

    // Retry on pending recipient should give 409 NOT_RETRYABLE
    const earlyRetry = await request(app)
      .post(`/projects/${projectId}/campaigns/${campaignId}/recipients/${firstRecipientId}/retry`);
    expect(earlyRetry.status).toBe(409);
    expect(earlyRetry.body.error.code).toBe('NOT_RETRYABLE');

    // Simulate failed status on recipient
    await prisma.campaignRecipient.update({
      where: { id: firstRecipientId },
      data: { status: 'failed', errorMessage: 'Delivery timeout' },
    });

    // Filter by status=failed
    const failedList = await request(app).get(`/projects/${projectId}/campaigns/${campaignId}/recipients?status=failed`);
    expect(failedList.body.data).toHaveLength(1);
    expect(failedList.body.data[0].id).toBe(firstRecipientId);

    // Retry failed recipient
    enqueuedMessages.length = 0;
    const retryRes = await request(app)
      .post(`/projects/${projectId}/campaigns/${campaignId}/recipients/${firstRecipientId}/retry`);
    expect(retryRes.status).toBe(200);
    expect(retryRes.body.data.status).toBe('pending');
    expect(enqueuedMessages).toHaveLength(1);
    expect(enqueuedMessages[0]).toEqual({ campaignId, recipientId: firstRecipientId });
  });

  it('foreign project gives 404', async () => {
    const foreignRes = await request(app).get(`/projects/${foreignProjectId}/campaigns`);
    expect(foreignRes.status).toBe(404);
    expect(foreignRes.body.error.code).toBe('NOT_FOUND');
  });
});
