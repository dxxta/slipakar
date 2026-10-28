import { execFileSync } from 'node:child_process';
import type { Request, Response, NextFunction } from 'express';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import request from 'supertest';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApplication, type Application } from '../composition.js';
import type { Env } from '../config/env.js';
import { startContainer } from '../test-support/start-container.js';
import { startGarage } from '../test-support/start-garage.js';

describe('End-to-End Background Sending Pipeline', () => {
  let pgContainer: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let rabbitContainer: StartedTestContainer;
  let garage: Awaited<ReturnType<typeof startGarage>>;
  let mailpitContainer: StartedTestContainer;

  let prisma: PrismaClient;
  let application: Application;

  let mailpitHttpUrl: string;
  let mailpitSmtpPort: number;
  let mailpitHost: string;

  const testUserId = 'e2e-user-1';
  const testUserEmail = 'e2e-owner@example.com';

  const fakeRequireAuth = (req: Request, res: Response, next: NextFunction): void => {
    req.user = { id: testUserId, email: testUserEmail, role: 'user' };
    res.locals.userId = testUserId;
    next();
  };

  beforeAll(async () => {
    // 1. Start all 5 containers
    [pgContainer, redisContainer, rabbitContainer, garage, mailpitContainer] = await Promise.all([
      startContainer(() => new PostgreSqlContainer('postgres:16').start()),
      startContainer(() => new RedisContainer('redis:7').start()),
      startContainer(() =>
        new GenericContainer('rabbitmq:3.13-alpine')
          .withExposedPorts(5672)
          .withWaitStrategy(Wait.forLogMessage(/Server startup complete/))
          .start(),
      ),
      startGarage(),
      startContainer(() =>
        new GenericContainer('axllent/mailpit')
          .withExposedPorts(1025, 8025)
          .withWaitStrategy(Wait.forHttp('/api/v1/messages', 8025))
          .start(),
      ),
    ]);

    const pgConn = pgContainer.getConnectionUri();
    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--config', 'apps/api/prisma.config.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: pgConn },
      stdio: 'pipe',
    });

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: pgConn }) });

    // Seed test user
    await prisma.user.create({
      data: {
        id: testUserId,
        email: testUserEmail,
        name: 'E2E Owner',
      },
    });

    mailpitHost = mailpitContainer.getHost();
    mailpitSmtpPort = mailpitContainer.getMappedPort(1025);
    const mailpitHttpPort = mailpitContainer.getMappedPort(8025);
    mailpitHttpUrl = `http://${mailpitHost}:${mailpitHttpPort}`;

    const rabbitHost = rabbitContainer.getHost();
    const rabbitPort = rabbitContainer.getMappedPort(5672);

    const testEnv: Env = {
      DATABASE_URL: pgConn,
      APP_ENCRYPTION_KEY: 'a'.repeat(64),
      GOOGLE_CLIENT_ID: 'fake-google-client-id',
      GOOGLE_CLIENT_SECRET: 'fake-google-client-secret',
      BETTER_AUTH_SECRET: 'fake-better-auth-secret-1234567890',
      BETTER_AUTH_URL: 'http://localhost:3000',
      S3_ENDPOINT: garage.endpoint,
      S3_PORT: garage.port,
      S3_USE_SSL: false,
      S3_ACCESS_KEY: garage.accessKey,
      S3_SECRET_KEY: garage.secretKey,
      S3_BUCKET: garage.bucket,
      S3_REGION: garage.region,
      S3_PATH_STYLE: garage.pathStyle,
      REDIS_URL: redisContainer.getConnectionUrl(),
      RABBITMQ_URL: `amqp://${rabbitHost}:${rabbitPort}`,
      ADMIN_EMAILS: ['admin@example.com'],
      PORT: 3000,
    };

    application = buildApplication({
      env: testEnv,
      prisma,
      requireAuth: fakeRequireAuth,
      sendRetry: {
        maxAttempts: 6,
        retryScheduleMs: [500, 500, 500, 500, 500],
      },
    });

    await application.start();
  }, 180_000);

  afterAll(async () => {
    await application?.stop();
    await prisma?.$disconnect();

    await Promise.allSettled([
      mailpitContainer?.stop(),
      garage?.stop(),
      rabbitContainer?.stop(),
      redisContainer?.stop(),
      pgContainer?.stop(),
    ]);
  }, 120_000);

  async function getMailpitMessages(): Promise<{ total: number; messages: Array<{ ID: string; To: Array<{ Address: string }>; Subject: string; Snippet: string }> }> {
    const res = await fetch(`${mailpitHttpUrl}/api/v1/messages`);
    if (!res.ok) throw new Error(`Mailpit API error: ${res.statusText}`);
    return (await res.json()) as { total: number; messages: Array<{ ID: string; To: Array<{ Address: string }>; Subject: string; Snippet: string }> };
  }

  async function getMailpitMessageDetail(id: string): Promise<{ HTML: string; Text: string; Subject: string; To: Array<{ Address: string }> }> {
    const res = await fetch(`${mailpitHttpUrl}/api/v1/message/${id}`);
    if (!res.ok) throw new Error(`Mailpit API error: ${res.statusText}`);
    return (await res.json()) as { HTML: string; Text: string; Subject: string; To: Array<{ Address: string }> };
  }

  async function clearMailpitMessages(): Promise<void> {
    await fetch(`${mailpitHttpUrl}/api/v1/messages`, { method: 'DELETE' });
  }

  it('campaign sent to 25 recipients processes in background with 202, sends all messages via SMTP, applies HTML escaping, and posts notification', async () => {
    await clearMailpitMessages();

    // 1. Create project
    const projRes = await request(application.app)
      .post('/projects')
      .send({ name: 'Bulk Send E2E Project' });
    expect(projRes.status).toBe(201);
    const projectId = projRes.body.data.id;

    // Update project rate limit so 25 sends don't throttle for minutes
    await prisma.project.update({
      where: { id: projectId },
      data: { rateLimitPerMinute: 600 },
    });

    // 2. Create SMTP connection pointing to Mailpit
    const smtpRes = await request(application.app)
      .post(`/projects/${projectId}/smtp`)
      .send({
        host: mailpitHost,
        port: mailpitSmtpPort,
        username: 'mailpit-user',
        password: 'mailpit-password',
        secure: false,
        fromAddress: 'payroll@company.com',
      });
    expect(smtpRes.status).toBe(201);
    const smtpId = smtpRes.body.data.id;

    // 3. Create email template with placeholders
    const tplRes = await request(application.app)
      .post(`/projects/${projectId}/templates`)
      .send({
        name: 'Payslip Template',
        subject: 'Payslip for {{name}}',
        bodyHtml: '<h1>Payslip</h1><p>Employee: {{name}}</p><p>Amount: {{amount}}</p>',
      });
    expect(tplRes.status).toBe(201);
    const templateId = tplRes.body.data.id;

    // 4. Upload a CSV with 25 recipients (name, email, amount) including one with <b> in name
    const csvRows = ['name,email,amount'];
    for (let i = 1; i <= 25; i += 1) {
      if (i === 1) {
        csvRows.push('"<b>Alice Bold</b>",alice@example.com,5000');
      } else {
        csvRows.push(`Recipient ${i},user${i}@example.com,${1000 + i * 100}`);
      }
    }
    const csvContent = Buffer.from(csvRows.join('\n'));

    const uploadRes = await request(application.app)
      .post(`/projects/${projectId}/uploads`)
      .attach('file', csvContent, 'recipients.csv');
    expect(uploadRes.status).toBe(201);
    const uploadId = uploadRes.body.data.id;

    // 5. Create mapping
    const mapRes = await request(application.app)
      .put(`/projects/${projectId}/mappings`)
      .send({
        templateId,
        uploadId,
        mapping: {
          name: 'name',
          amount: 'amount',
        },
      });
    expect(mapRes.status).toBe(200);

    // 6. Create campaign
    const campRes = await request(application.app)
      .post(`/projects/${projectId}/campaigns`)
      .send({
        emailTemplateId: templateId,
        smtpConnectionId: smtpId,
        uploadId,
        emailColumn: 'email',
      });
    expect(campRes.status).toBe(201);
    const campaignId = campRes.body.data.id;
    expect(campRes.body.data.status).toBe('draft');

    // 7. Send campaign -> assert immediate 202 and status is sending
    const sendRes = await request(application.app)
      .post(`/projects/${projectId}/campaigns/${campaignId}/send`);
    expect(sendRes.status).toBe(202);
    expect(sendRes.body.data.status).toBe('sending');

    // 8. Assert sending the same campaign again immediately returns 409
    const secondSendRes = await request(application.app)
      .post(`/projects/${projectId}/campaigns/${campaignId}/send`);
    expect(secondSendRes.status).toBe(409);

    // 9. Poll (max 60s) until the campaign finishes
    const startMs = Date.now();
    let currentStatus = 'sending';
    while (Date.now() - startMs < 60_000) {
      const pollRes = await request(application.app)
        .get(`/projects/${projectId}/campaigns/${campaignId}`);
      expect(pollRes.status).toBe(200);
      currentStatus = pollRes.body.data.status;
      if (currentStatus === 'completed' || currentStatus === 'completed_with_errors') {
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    expect(currentStatus).toBe('completed');

    // 10. Mailpit holds exactly 25 messages each addressed to the right recipient
    const mailpitData = await getMailpitMessages();
    expect(mailpitData.total).toBe(25);
    expect(mailpitData.messages).toHaveLength(25);

    // Check recipients addresses
    const deliveredAddresses = mailpitData.messages.flatMap((m) => m.To.map((t) => t.Address));
    expect(deliveredAddresses).toContain('alice@example.com');
    for (let i = 2; i <= 25; i += 1) {
      expect(deliveredAddresses).toContain(`user${i}@example.com`);
    }

    // Verify HTML escaping on the recipient with <b> tag
    const aliceSummary = mailpitData.messages.find((m) =>
      m.To.some((t) => t.Address === 'alice@example.com'),
    );
    expect(aliceSummary).toBeDefined();
    const aliceDetail = await getMailpitMessageDetail(aliceSummary!.ID);

    expect(aliceDetail.Subject).toBe('Payslip for <b>Alice Bold</b>');
    // In HTML body, it should be escaped: &lt;b&gt;Alice Bold&lt;/b&gt;
    expect(aliceDetail.HTML).toContain('&lt;b&gt;Alice Bold&lt;/b&gt;');
    expect(aliceDetail.HTML).not.toContain('<p>Employee: <b>Alice Bold</b></p>');

    // 11. Notifications contains exactly one campaign_finished for the user
    const notifRes = await request(application.app)
      .get(`/projects/${projectId}/notifications`);
    expect(notifRes.status).toBe(200);
    const notifications = notifRes.body.data as Array<{ type: string; campaignId?: string }>;
    const campaignFinishedNotifs = notifications.filter(
      (n) => n.type === 'campaign_finished' && n.campaignId === campaignId,
    );
    expect(campaignFinishedNotifs).toHaveLength(1);
  }, 120_000);

  it('campaign creation with an invalid recipient email rejects with 400 INVALID_RECIPIENT_EMAIL and nothing is queued or delivered', async () => {
    await clearMailpitMessages();

    // 1. Create project
    const projRes = await request(application.app)
      .post('/projects')
      .send({ name: 'Invalid Email Reject Project' });
    expect(projRes.status).toBe(201);
    const projectId = projRes.body.data.id;

    // 2. Create SMTP connection
    const smtpRes = await request(application.app)
      .post(`/projects/${projectId}/smtp`)
      .send({
        host: mailpitHost,
        port: mailpitSmtpPort,
        username: 'mailpit-user',
        password: 'mailpit-password',
        secure: false,
        fromAddress: 'notifications@company.com',
      });
    expect(smtpRes.status).toBe(201);
    const smtpId = smtpRes.body.data.id;

    // 3. Create template
    const tplRes = await request(application.app)
      .post(`/projects/${projectId}/templates`)
      .send({
        name: 'Notice Template',
        subject: 'Notice for {{name}}',
        bodyHtml: '<p>Hello {{name}}</p>',
      });
    expect(tplRes.status).toBe(201);
    const templateId = tplRes.body.data.id;

    // 4. Upload CSV with 4 recipients, where one row has an invalid email format
    const csvContent = Buffer.from(
      [
        'name,email',
        'Valid One,valid1@example.com',
        'Invalid User,not-an-email',
        'Valid Two,valid2@example.com',
        'Valid Three,valid3@example.com',
      ].join('\n'),
    );

    const uploadRes = await request(application.app)
      .post(`/projects/${projectId}/uploads`)
      .attach('file', csvContent, 'recipients-invalid.csv');
    expect(uploadRes.status).toBe(201);
    const uploadId = uploadRes.body.data.id;

    // 5. Mapping
    const mapRes = await request(application.app)
      .put(`/projects/${projectId}/mappings`)
      .send({
        templateId,
        uploadId,
        mapping: { name: 'name' },
      });
    expect(mapRes.status).toBe(200);

    // 6. Campaign creation -> assert 400 INVALID_RECIPIENT_EMAIL
    const campRes = await request(application.app)
      .post(`/projects/${projectId}/campaigns`)
      .send({
        emailTemplateId: templateId,
        smtpConnectionId: smtpId,
        uploadId,
        emailColumn: 'email',
      });
    expect(campRes.status).toBe(400);
    expect(campRes.body.error).toBeDefined();
    expect(campRes.body.error.code).toBe('INVALID_RECIPIENT_EMAIL');

    // 7. Verify no campaign was created in this project
    const listCampRes = await request(application.app)
      .get(`/projects/${projectId}/campaigns`);
    expect(listCampRes.status).toBe(200);
    expect(listCampRes.body.data).toHaveLength(0);

    // 8. Verify no mail was delivered to Mailpit
    const mailpitData = await getMailpitMessages();
    expect(mailpitData.total).toBe(0);
    expect(mailpitData.messages).toHaveLength(0);
  }, 120_000);

  it('campaign handles SMTP outage mid-campaign: pauses while retries pending, finishes after unpause with all 10 messages and no duplicates', async () => {
    await clearMailpitMessages();

    // 1. Create project
    const projRes = await request(application.app)
      .post('/projects')
      .send({ name: 'SMTP Outage Recovery Project' });
    expect(projRes.status).toBe(201);
    const projectId = projRes.body.data.id;

    // High rate limit
    await prisma.project.update({
      where: { id: projectId },
      data: { rateLimitPerMinute: 600 },
    });

    // 2. Create SMTP connection pointing to Mailpit
    const smtpRes = await request(application.app)
      .post(`/projects/${projectId}/smtp`)
      .send({
        host: mailpitHost,
        port: mailpitSmtpPort,
        username: 'mailpit-user',
        password: 'mailpit-password',
        secure: false,
        fromAddress: 'outage-test@company.com',
      });
    expect(smtpRes.status).toBe(201);
    const smtpId = smtpRes.body.data.id;

    // 3. Create template
    const tplRes = await request(application.app)
      .post(`/projects/${projectId}/templates`)
      .send({
        name: 'Outage Test Template',
        subject: 'Order confirmation for {{name}}',
        bodyHtml: '<p>Hello {{name}}, your order id is {{orderId}}</p>',
      });
    expect(tplRes.status).toBe(201);
    const templateId = tplRes.body.data.id;

    // 4. Upload CSV with 10 recipients
    const rows = ['name,email,orderId'];
    for (let i = 1; i <= 10; i += 1) {
      rows.push(`Customer ${i},customer${i}@example.com,ORD-${1000 + i}`);
    }
    const csvContent = Buffer.from(rows.join('\n'));

    const uploadRes = await request(application.app)
      .post(`/projects/${projectId}/uploads`)
      .attach('file', csvContent, 'recipients-10.csv');
    expect(uploadRes.status).toBe(201);
    const uploadId = uploadRes.body.data.id;

    // 5. Mapping
    const mapRes = await request(application.app)
      .put(`/projects/${projectId}/mappings`)
      .send({
        templateId,
        uploadId,
        mapping: {
          name: 'name',
          orderId: 'orderId',
        },
      });
    expect(mapRes.status).toBe(200);

    // 6. Campaign
    const campRes = await request(application.app)
      .post(`/projects/${projectId}/campaigns`)
      .send({
        emailTemplateId: templateId,
        smtpConnectionId: smtpId,
        uploadId,
        emailColumn: 'email',
      });
    expect(campRes.status).toBe(201);
    const campaignId = campRes.body.data.id;

    // 7. Send campaign -> 202 Accepted
    const sendRes = await request(application.app)
      .post(`/projects/${projectId}/campaigns/${campaignId}/send`);
    expect(sendRes.status).toBe(202);
    expect(sendRes.body.data.status).toBe('sending');

    // 8. Wait until first few messages arrive, then pause mailpit
    const mailpitContainerId = mailpitContainer.getId();
    const waitStart = Date.now();
    while (Date.now() - waitStart < 15_000) {
      const msgs = await getMailpitMessages();
      if (msgs.total >= 1 && msgs.total < 10) {
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    // Pause container to simulate SMTP outage
    execFileSync('docker', ['pause', mailpitContainerId]);

    try {
      // 9. While SMTP is paused, wait a moment for remaining messages to encounter connection failure & retry
      await new Promise((r) => setTimeout(r, 2000));

      // Assert campaign is NOT finished while retries are pending
      const duringOutageRes = await request(application.app)
        .get(`/projects/${projectId}/campaigns/${campaignId}`);
      expect(duringOutageRes.status).toBe(200);
      expect(duringOutageRes.body.data.status).toBe('sending');

      // Assert no campaign_finished notification has been emitted yet
      const notifsDuringOutage = await request(application.app)
        .get(`/projects/${projectId}/notifications`);
      expect(notifsDuringOutage.status).toBe(200);
      const finishedNotifs = (notifsDuringOutage.body.data as Array<{ type: string; campaignId?: string }>).filter(
        (n) => n.type === 'campaign_finished' && n.campaignId === campaignId,
      );
      expect(finishedNotifs).toHaveLength(0);
    } finally {
      // 10. Unpause mailpit to restore SMTP service
      execFileSync('docker', ['unpause', mailpitContainerId]);
    }

    // 11. Poll (max 60s) until campaign completes
    const pollStart = Date.now();
    let finalStatus = 'sending';
    while (Date.now() - pollStart < 60_000) {
      const pollRes = await request(application.app)
        .get(`/projects/${projectId}/campaigns/${campaignId}`);
      expect(pollRes.status).toBe(200);
      finalStatus = pollRes.body.data.status;
      if (finalStatus === 'completed' || finalStatus === 'completed_with_errors') {
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    expect(finalStatus).toBe('completed');

    // 12. Assert Mailpit holds all 10 messages with NO duplicates
    const allMessagesData = await getMailpitMessages();
    expect(allMessagesData.total).toBe(10);
    expect(allMessagesData.messages).toHaveLength(10);

    const deliveredEmails = allMessagesData.messages.flatMap((m) => m.To.map((t) => t.Address));
    expect(deliveredEmails).toHaveLength(10);
    for (let i = 1; i <= 10; i += 1) {
      const email = `customer${i}@example.com`;
      const matches = deliveredEmails.filter((e) => e === email);
      expect(matches).toHaveLength(1); // exactly once, no duplicate
    }

    // 13. Exactly one campaign_finished notification exists
    const finalNotifsRes = await request(application.app)
      .get(`/projects/${projectId}/notifications`);
    expect(finalNotifsRes.status).toBe(200);
    const finalNotifs = (finalNotifsRes.body.data as Array<{ type: string; campaignId?: string }>).filter(
      (n) => n.type === 'campaign_finished' && n.campaignId === campaignId,
    );
    expect(finalNotifs).toHaveLength(1);
  }, 120_000);
});
