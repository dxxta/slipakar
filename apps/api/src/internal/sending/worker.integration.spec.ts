import { startContainer } from '../../test-support/start-container.js';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildAuditRepository } from '../audit/repository/audit.js';
import type { NotifyMessage, QueuePublisher } from '../../domain/queue/interface.js';
import type { SmtpSenderInterface } from '../../domain/smtp/interface.js';
import { createCryptoService } from '../../services/crypto.js';
import { buildRateLimiter } from './rate-limiter.js';
import { buildSendWorker } from './worker.js';
import { buildSmtpSender } from '../smtp/sender/smtp-sender.js';
import { buildQueue } from '../queue/queue.js';

async function getClosedLocalPort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
  });
}

describe('SendWorker Integration', () => {
  let pgContainer: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let rabbitContainer: StartedTestContainer;
  let amqpUrl: string;
  let prisma: PrismaClient;
  let redis: Redis;

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
    redis = new Redis(redisContainer.getConnectionUrl());

    rabbitContainer = await startContainer(() =>
      new GenericContainer('rabbitmq:3.13-management-alpine')
        .withExposedPorts(5672)
        .withWaitStrategy(Wait.forLogMessage(/Server startup complete/))
        .start(),
    );
    amqpUrl = `amqp://${rabbitContainer.getHost()}:${rabbitContainer.getMappedPort(5672)}`;
  }, 120_000);

  afterAll(async () => {
    redis?.disconnect();
    await prisma?.$disconnect();
    await rabbitContainer?.stop();
    await redisContainer?.stop();
    await pgContainer?.stop();
  }, 120_000);

  it('campaign of 3 recipients where the second send fails ends with campaign completed_with_errors, statuses sent/failed/sent, one campaign_finished and one send_failed message', async () => {
    const cryptoService = createCryptoService('a'.repeat(64));
    const encryptedPassword = cryptoService.encrypt('smtp-secret');

    // Create user and project
    const user = await prisma.user.create({ data: { email: 'owner@example.com', name: 'Owner' } });
    const project = await prisma.project.create({ data: { ownerId: user.id, name: 'Project 1', rateLimitPerMinute: 60 } });

    // Create template
    const template = await prisma.emailTemplate.create({
      data: {
        projectId: project.id,
        name: 'Payslip',
        subject: 'Hello {{name}}',
        bodyHtml: '<p>Amount: {{amount}}</p>',
      },
    });

    // Create SMTP connection
    const smtp = await prisma.smtpConnection.create({
      data: {
        projectId: project.id,
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        username: 'billing@example.com',
        passwordEncrypted: encryptedPassword,
      },
    });

    // Create upload
    const upload = await prisma.dataUpload.create({
      data: {
        projectId: project.id,
        fileName: 'recipients.csv',
        columns: ['name', 'amount', 'email'],
        rows: [
          { name: 'Alice', amount: '100', email: 'alice@example.com' },
          { name: 'Bob', amount: '200', email: 'bob@example.com' },
          { name: 'Charlie', amount: '300', email: 'charlie@example.com' },
        ],
        rowCount: 3,
      },
    });

    // Create FieldMapping
    await prisma.fieldMapping.create({
      data: {
        templateId: template.id,
        uploadId: upload.id,
        mapping: { name: 'name', amount: 'amount' },
      },
    });

    // Create Campaign with 3 recipients
    const campaign = await prisma.campaign.create({
      data: {
        projectId: project.id,
        emailTemplateId: template.id,
        smtpConnectionId: smtp.id,
        uploadId: upload.id,
        emailColumn: 'email',
        status: 'sending',
        recipients: {
          create: [
            { rowIndex: 0, email: 'alice@example.com', status: 'pending' },
            { rowIndex: 1, email: 'bob@example.com', status: 'pending' },
            { rowIndex: 2, email: 'charlie@example.com', status: 'pending' },
          ],
        },
      },
      include: { recipients: { orderBy: { rowIndex: 'asc' } } },
    });

    const publishedNotifies: NotifyMessage[] = [];
    const queue: QueuePublisher = {
      publishSendEmail: async () => {},
      publishNotify: async (msg: NotifyMessage) => {
        publishedNotifies.push(msg);
      },
    };

    const sender: SmtpSenderInterface = {
      verify: async () => ({ ok: true }),
      sendMail: async (_config, mail) => {
        if (mail.to === 'bob@example.com') {
          return { ok: false, error: 'Recipient address rejected: mailbox not found' };
        }
        return { ok: true };
      },
    };

    const rateLimiter = buildRateLimiter({ redis });
    const auditRepository = buildAuditRepository(prisma);

    const worker = buildSendWorker({
      prisma,
      queue,
      cryptoService,
      sender,
      rateLimiter,
      engine: {
        renderTemplate(t, r) {
          return {
            subject: t.subject.replace('{{name}}', r.name ?? ''),
            body: t.bodyHtml.replace('{{amount}}', r.amount ?? ''),
          };
        },
      },
      auditRepository,
    });

    // Process recipients
    for (const recipient of campaign.recipients) {
      await worker.handleSendEmail({ campaignId: campaign.id, recipientId: recipient.id });
    }

    // Verify recipient statuses
    const recipients = await prisma.campaignRecipient.findMany({
      where: { campaignId: campaign.id },
      orderBy: { rowIndex: 'asc' },
    });

    expect(recipients[0].status).toBe('sent');
    expect(recipients[1].status).toBe('failed');
    expect(recipients[1].errorMessage).toContain('Recipient address rejected');
    expect(recipients[2].status).toBe('sent');

    // Verify campaign status
    const updatedCampaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(updatedCampaign.status).toBe('completed_with_errors');

    // Verify published notifications
    const sendFailedNotifies = publishedNotifies.filter((n) => n.type === 'send_failed');
    const campaignFinishedNotifies = publishedNotifies.filter((n) => n.type === 'campaign_finished');

    expect(sendFailedNotifies).toHaveLength(1);
    expect(sendFailedNotifies[0]).toMatchObject({
      type: 'send_failed',
      projectId: project.id,
      campaignId: campaign.id,
      message: 'Sending to row 1 failed',
    });

    expect(campaignFinishedNotifies).toHaveLength(1);
    expect(campaignFinishedNotifies[0]).toMatchObject({
      type: 'campaign_finished',
      projectId: project.id,
      campaignId: campaign.id,
    });
    expect(campaignFinishedNotifies[0].message).toContain('2 sent, 1 failed');
  });

  it('campaign with PDF template and shared attachment sends 2 attachments (first bytes %PDF) and creates generated Attachment rows', async () => {
    const cryptoService = createCryptoService('b'.repeat(64));
    const encryptedPassword = cryptoService.encrypt('smtp-secret-2');

    const user = await prisma.user.create({ data: { email: 'owner-pdf@example.com', name: 'Owner PDF' } });
    const project = await prisma.project.create({ data: { ownerId: user.id, name: 'PDF Project', rateLimitPerMinute: 60 } });

    const template = await prisma.emailTemplate.create({
      data: {
        projectId: project.id,
        name: 'Email with PDF',
        subject: 'Payslip {{name}}',
        bodyHtml: '<p>Attached is your payslip.</p>',
      },
    });

    const pdfTemplate = await prisma.pdfTemplate.create({
      data: {
        projectId: project.id,
        name: 'Payslip PDF',
        nodeTree: {
          page: { size: 'A4', margin: 0 },
          nodes: [
            {
              id: 'text-1',
              type: 'text',
              x: 50,
              y: 50,
              width: 200,
              height: 20,
              content: 'Payslip for {{name}}',
              style: { fontSize: 12, bold: false, align: 'left', color: '#000000' },
            },
          ],
        },
      },
    });

    const smtp = await prisma.smtpConnection.create({
      data: {
        projectId: project.id,
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        username: 'payroll@example.com',
        fromAddress: 'noreply-payroll@example.com',
        passwordEncrypted: encryptedPassword,
      },
    });

    const upload = await prisma.dataUpload.create({
      data: {
        projectId: project.id,
        fileName: 'recipients.csv',
        columns: ['name', 'email'],
        rows: [{ name: 'Alice', email: 'alice@example.com' }],
        rowCount: 1,
      },
    });

    await prisma.fieldMapping.create({
      data: {
        templateId: template.id,
        uploadId: upload.id,
        mapping: { name: 'name' },
      },
    });

    const campaign = await prisma.campaign.create({
      data: {
        projectId: project.id,
        emailTemplateId: template.id,
        pdfTemplateId: pdfTemplate.id,
        smtpConnectionId: smtp.id,
        uploadId: upload.id,
        emailColumn: 'email',
        status: 'sending',
        recipients: {
          create: [{ rowIndex: 0, email: 'alice@example.com', status: 'pending' }],
        },
      },
      include: { recipients: true },
    });

    // In-memory fake storage
    const storageMap = new Map<string, Buffer>();
    const fakeStorage = {
      async ensureBucket(): Promise<void> {},
      async putObject(input: { key: string; body: Buffer }): Promise<void> {
        storageMap.set(input.key, input.body);
      },
      async getObject(key: string): Promise<Buffer> {
        const found = storageMap.get(key);
        if (!found) throw new Error('Not found');
        return found;
      },
      async deleteObject(key: string): Promise<void> {
        storageMap.delete(key);
      },
      async objectExists(key: string): Promise<boolean> {
        return storageMap.has(key);
      },
    };

    // Shared extra attachment for campaign
    const sharedKey = `${project.id}/shared.pdf`;
    storageMap.set(sharedKey, Buffer.from('%PDF-1.4 shared attachment'));
    await prisma.attachment.create({
      data: {
        projectId: project.id,
        campaignId: campaign.id,
        objectKey: sharedKey,
        fileName: 'shared.pdf',
        sizeBytes: BigInt(storageMap.get(sharedKey)!.length),
        kind: 'extra',
      },
    });

    let sentMailCaptured: { from: string; to: string; subject: string; html: string; attachments?: { filename: string; content: Buffer; contentType: string }[] } | null = null;
    const sender: SmtpSenderInterface = {
      verify: async () => ({ ok: true }),
      sendMail: async (_config, mail) => {
        sentMailCaptured = mail;
        return { ok: true };
      },
    };

    const { buildAttachmentStore } = await import('../attachments/attachment-store.js');
    const { buildPdfRenderer } = await import('../pdf/renderer.js');
    const auditRepository = buildAuditRepository(prisma);

    const attachmentStore = buildAttachmentStore({
      prisma,
      storage: fakeStorage,
      auditRepository,
    });

    const pdfRenderer = buildPdfRenderer({
      imageLoader: async () => null,
    });

    const worker = buildSendWorker({
      prisma,
      queue: {
        publishSendEmail: async () => {},
        publishNotify: async () => {},
      },
      cryptoService,
      sender,
      rateLimiter: buildRateLimiter({ redis }),
      engine: {
        renderTemplate(t, r) {
          return {
            subject: t.subject.replace('{{name}}', r.name ?? ''),
            body: t.bodyHtml,
          };
        },
      },
      auditRepository,
      storage: fakeStorage,
      pdfRenderer,
      attachmentStore,
    });

    await worker.handleSendEmail({
      campaignId: campaign.id,
      recipientId: campaign.recipients[0].id,
    });

    // Check sent mail attachments
    expect(sentMailCaptured).not.toBeNull();
    expect(sentMailCaptured.from).toBe('noreply-payroll@example.com');
    expect(sentMailCaptured.attachments).toHaveLength(2);

    const pdfAttachment = sentMailCaptured.attachments?.find((a) => a.filename === 'document-row-1.pdf');
    const extraAttachment = sentMailCaptured.attachments?.find((a) => a.filename === 'shared.pdf');

    expect(pdfAttachment).toBeDefined();
    expect(extraAttachment).toBeDefined();
    expect(pdfAttachment!.content.subarray(0, 4).toString('utf-8')).toBe('%PDF');

    // Check generated Attachment rows in DB
    const generatedAttachment = await prisma.attachment.findFirst({
      where: {
        campaignId: campaign.id,
        kind: 'generated',
        fileName: 'document-row-1.pdf',
      },
    });
    expect(generatedAttachment).not.toBeNull();
  });

  it('campaign sending survives SMTP server down at first, retries via RabbitMQ, and completes when SMTP comes up', async () => {
    const queue = buildQueue({ url: amqpUrl });
    await queue.start();

    // 2. Prepare user, project, template, data upload with 3 recipients
    const cryptoService = createCryptoService('c'.repeat(64));
    const encryptedPassword = cryptoService.encrypt('smtp-pwd');

    const user = await prisma.user.create({ data: { email: 'retry-owner@example.com', name: 'Retry Owner' } });
    const project = await prisma.project.create({ data: { ownerId: user.id, name: 'Retry Project', rateLimitPerMinute: 600 } });

    const template = await prisma.emailTemplate.create({
      data: {
        projectId: project.id,
        name: 'Retry Template',
        subject: 'Notice for {{name}}',
        bodyHtml: '<p>Hi {{name}}</p>',
      },
    });

    const upload = await prisma.dataUpload.create({
      data: {
        projectId: project.id,
        fileName: 'people.csv',
        columns: ['name', 'email'],
        rows: [
          { name: 'User 1', email: 'u1@example.com' },
          { name: 'User 2', email: 'u2@example.com' },
          { name: 'User 3', email: 'u3@example.com' },
        ],
        rowCount: 3,
      },
    });

    await prisma.fieldMapping.create({
      data: {
        templateId: template.id,
        uploadId: upload.id,
        mapping: { name: 'name' },
      },
    });

    // 3. Point SMTP connection at a dynamically reserved closed local port initially
    const closedPort1 = await getClosedLocalPort();
    const smtp = await prisma.smtpConnection.create({
      data: {
        projectId: project.id,
        host: '127.0.0.1',
        port: closedPort1, // closed port -> ECONNREFUSED
        secure: false,
        username: 'test@example.com',
        passwordEncrypted: encryptedPassword,
      },
    });

    const campaign = await prisma.campaign.create({
      data: {
        projectId: project.id,
        emailTemplateId: template.id,
        smtpConnectionId: smtp.id,
        uploadId: upload.id,
        emailColumn: 'email',
        status: 'sending',
        recipients: {
          create: [
            { rowIndex: 0, email: 'u1@example.com', status: 'pending' },
            { rowIndex: 1, email: 'u2@example.com', status: 'pending' },
            { rowIndex: 2, email: 'u3@example.com', status: 'pending' },
          ],
        },
      },
      include: { recipients: { orderBy: { rowIndex: 'asc' } } },
    });

    const realSender = buildSmtpSender();
    const rateLimiter = buildRateLimiter({ redis });
    const auditRepository = buildAuditRepository(prisma);

    const publishedNotifies: NotifyMessage[] = [];
    const queueWrapper: typeof queue = {
      ...queue,
      publishNotify: async (msg) => {
        publishedNotifies.push(msg);
        return queue.publishNotify(msg);
      },
    };

    // Track captured errors to deterministically observe failure before bringing SMTP up
    const capturedFailures: unknown[] = [];
    const errorReporter = {
      capture: (error: unknown) => {
        capturedFailures.push(error);
      },
    };

    const worker = buildSendWorker({
      prisma,
      queue: queueWrapper,
      cryptoService,
      sender: realSender,
      rateLimiter,
      engine: {
        renderTemplate(t, r) {
          return {
            subject: t.subject.replace('{{name}}', r.name ?? ''),
            body: t.bodyHtml.replace('{{name}}', r.name ?? ''),
          };
        },
      },
      auditRepository,
      maxAttempts: 8,
      retryScheduleMs: Array(8).fill(500),
      errorReporter,
    });

    // Start consuming send.email queue with worker
    await queue.consumeSendEmail(async (msg) => {
      await worker.handleSendEmail(msg);
    });

    // Publish all 3 recipients to the queue while SMTP is down
    for (const recipient of campaign.recipients) {
      await queue.publishSendEmail({ campaignId: campaign.id, recipientId: recipient.id });
    }

    // Wait deterministically for at least one failed send attempt to be captured by errorReporter
    await vi.waitFor(() => {
      expect(capturedFailures.length).toBeGreaterThanOrEqual(1);
    }, { timeout: 60_000 });

    // Verify recipients in DB are still non-final ('pending', not 'failed')
    const midRecipients = await prisma.campaignRecipient.findMany({
      where: { campaignId: campaign.id },
    });
    expect(midRecipients.every((r) => r.status === 'pending')).toBe(true);

    // Verify campaign is still in 'sending' state
    const midCampaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(midCampaign.status).toBe('sending');

    // 4. Now bring SMTP up by starting Mailpit container!
    const mailpitContainer = await startContainer(() =>
      new GenericContainer('axllent/mailpit')
        .withExposedPorts(1025, 8025)
        .withWaitStrategy(Wait.forHttp('/api/v1/messages', 8025))
        .start(),
    );
    const mailpitHost = mailpitContainer.getHost();
    const mailpitSmtpPort = mailpitContainer.getMappedPort(1025);
    const mailpitHttpPort = mailpitContainer.getMappedPort(8025);

    // Update SMTP connection in database to point to live Mailpit
    await prisma.smtpConnection.update({
      where: { id: smtp.id },
      data: {
        host: mailpitHost,
        port: mailpitSmtpPort,
      },
    });

    // 5. As delayed retries dead-letter back to send.email, worker retries succeed
    // Wait for all 3 recipients to reach 'sent' status
    await vi.waitFor(async () => {
      const updatedRecipients = await prisma.campaignRecipient.findMany({
        where: { campaignId: campaign.id },
      });
      expect(updatedRecipients.every((r) => r.status === 'sent')).toBe(true);
    }, { timeout: 60_000 });

    // Wait for campaign status to reach 'completed'
    await vi.waitFor(async () => {
      const finalCampaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
      expect(finalCampaign.status).toBe('completed');
    }, { timeout: 60_000 });

    // Verify exactly one campaign_finished notification was published
    const campaignFinishedNotifies = publishedNotifies.filter((n) => n.type === 'campaign_finished');
    expect(campaignFinishedNotifies).toHaveLength(1);

    // Verify emails actually arrived in Mailpit (all 3 delivered)
    const res = await fetch(`http://${mailpitHost}:${mailpitHttpPort}/api/v1/messages`);
    const mailpitData = (await res.json()) as { total: number; messages: Array<{ To: Array<{ Address: string }> }> };
    expect(mailpitData.total).toBe(3);

    // Clean up
    await queue.stop();
    await mailpitContainer.stop();
  }, 120_000);

  it('campaign sending exhausts retries when SMTP stays permanently down, marks failed with safe error, campaign completed_with_errors', async () => {
    const queue = buildQueue({ url: amqpUrl });
    await queue.start();

    const cryptoService = createCryptoService('d'.repeat(64));
    const encryptedPassword = cryptoService.encrypt('smtp-pwd');

    const user = await prisma.user.create({ data: { email: 'exhaust-owner@example.com', name: 'Exhaust Owner' } });
    const project = await prisma.project.create({ data: { ownerId: user.id, name: 'Exhaust Project', rateLimitPerMinute: 600 } });

    const template = await prisma.emailTemplate.create({
      data: {
        projectId: project.id,
        name: 'Exhaust Template',
        subject: 'Notice for {{name}}',
        bodyHtml: '<p>Hi {{name}}</p>',
      },
    });

    const upload = await prisma.dataUpload.create({
      data: {
        projectId: project.id,
        fileName: 'exhaust.csv',
        columns: ['name', 'email'],
        rows: [{ name: 'Fail User', email: 'fail@example.com' }],
        rowCount: 1,
      },
    });

    await prisma.fieldMapping.create({
      data: {
        templateId: template.id,
        uploadId: upload.id,
        mapping: { name: 'name' },
      },
    });

    const closedPort2 = await getClosedLocalPort();
    const smtp = await prisma.smtpConnection.create({
      data: {
        projectId: project.id,
        host: '127.0.0.1',
        port: closedPort2, // closed port
        secure: false,
        username: 'test@example.com',
        passwordEncrypted: encryptedPassword,
      },
    });

    const campaign = await prisma.campaign.create({
      data: {
        projectId: project.id,
        emailTemplateId: template.id,
        smtpConnectionId: smtp.id,
        uploadId: upload.id,
        emailColumn: 'email',
        status: 'sending',
        recipients: {
          create: [{ rowIndex: 0, email: 'fail@example.com', status: 'pending' }],
        },
      },
      include: { recipients: true },
    });

    const realSender = buildSmtpSender();
    const rateLimiter = buildRateLimiter({ redis });
    const auditRepository = buildAuditRepository(prisma);

    const reportedErrors: Array<{ error: unknown; context?: Record<string, unknown> }> = [];
    const errorReporter = {
      capture: (error: unknown, context?: Record<string, unknown>) => {
        reportedErrors.push({ error, context });
      },
    };

    const worker = buildSendWorker({
      prisma,
      queue,
      cryptoService,
      sender: realSender,
      rateLimiter,
      engine: {
        renderTemplate(t, r) {
          return {
            subject: t.subject.replace('{{name}}', r.name ?? ''),
            body: t.bodyHtml.replace('{{name}}', r.name ?? ''),
          };
        },
      },
      auditRepository,
      maxAttempts: 2,
      retryScheduleMs: [50, 50],
      errorReporter,
    });

    await queue.consumeSendEmail(async (msg) => {
      await worker.handleSendEmail(msg);
    });

    await queue.publishSendEmail({ campaignId: campaign.id, recipientId: campaign.recipients[0].id });

    // Wait for retries to exhaust, recipient to be marked failed, and campaign to reach completed_with_errors
    await vi.waitFor(async () => {
      const recipient = await prisma.campaignRecipient.findUniqueOrThrow({
        where: { id: campaign.recipients[0].id },
      });
      expect(recipient.status).toBe('failed');
      expect(recipient.errorMessage).toBe('SMTP server unavailable after 2 attempts');

      const finalCampaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
      expect(finalCampaign.status).toBe('completed_with_errors');
    }, { timeout: 30_000 });

    // Verify errorReporter was called for each failed attempt
    expect(reportedErrors).toHaveLength(2);
    expect(reportedErrors[0].context).toMatchObject({
      campaignId: campaign.id,
      recipientId: campaign.recipients[0].id,
      attempt: 1,
      transient: true,
    });
    expect(reportedErrors[1].context).toMatchObject({
      campaignId: campaign.id,
      recipientId: campaign.recipients[0].id,
      attempt: 2,
      transient: true,
    });

    await queue.stop();
  }, 120_000);
});
