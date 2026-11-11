import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startContainer } from '../../../../test-support/start-container.js';
import { buildApp } from '../../../../composition.js';
import { makeSignature } from 'better-auth/crypto';

const adminEmail = 'admin-setup@example.com';
const userEmail = 'user-setup@example.com';
const trustedOrigin = 'http://localhost:8080';
const authSecret = 'better-auth-secret-long-enough-for-tests';

async function buildSignedSessionCookie(token: string): Promise<string> {
  const signature = await makeSignature(token, authSecret);
  return `better-auth.session_token=${token}.${signature}`;
}

describe('Admin Setup Gate HTTP integration', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let userCookie: string;

  beforeAll(async () => {
    container = await startContainer(() => new PostgreSqlContainer('postgres:16').start());
    const connectionString = container.getConnectionUri();
    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--config', 'apps/api/prisma.config.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: connectionString },
      stdio: 'pipe',
    });
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Admin Setup User',
        role: 'admin',
      },
    });
    void admin;

    const normalUser = await prisma.user.create({
      data: {
        email: userEmail,
        name: 'Normal User',
        role: 'user',
      },
    });

    const adminSession = await prisma.session.create({
      data: {
        userId: admin.id,
        token: 'admin-setup-session-token',
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    adminCookie = await buildSignedSessionCookie(adminSession.token);

    const userSession = await prisma.session.create({
      data: {
        userId: normalUser.id,
        token: 'user-setup-session-token',
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    userCookie = await buildSignedSessionCookie(userSession.token);

    app = buildApp({
      env: {
        DATABASE_URL: connectionString,
        APP_ENCRYPTION_KEY: 'b'.repeat(64),
        GOOGLE_CLIENT_ID: 'google-client-id',
        GOOGLE_CLIENT_SECRET: 'google-client-secret',
        BETTER_AUTH_SECRET: authSecret,
        BETTER_AUTH_URL: 'http://localhost:3000',
        TRUSTED_ORIGINS: [trustedOrigin],
        API_ACCESS_ENABLED: false,
        API_ALLOWED_ORIGINS: [],
        EMBED_ALLOWED_ORIGINS: [],
        S3_ENDPOINT: 'localhost',
        S3_PORT: 3900,
        S3_USE_SSL: false,
        S3_ACCESS_KEY: 'test-access',
        S3_SECRET_KEY: 'test-secret',
        S3_BUCKET: 'test-bucket',
        S3_REGION: 'garage',
        S3_PATH_STYLE: true,
        REDIS_URL: 'redis://localhost:6379',
        RABBITMQ_URL: 'amqp://guest:guest@localhost:5672',
        ADMIN_EMAILS: [adminEmail],
        PORT: 3000,
        TRUST_PROXY: '1',
        SEED_DEMO_PROJECT: false,
        SETUP_GRAFANA_URL: 'http://grafana:3000',
        SETUP_UPTIME_URL: 'http://uptime-kuma:3001',
        SETUP_UPTIME_USERNAME: 'admin',
        SETUP_UPTIME_PASSWORD: 'environment-password',
      },
      prisma,
    });
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  it('rejects non-admin access with 403', async () => {
    const res = await request(app)
      .get('/admin/setup')
      .set('Origin', trustedOrigin)
      .set('Cookie', userCookie);
    expect(res.status).toBe(403);
  });

  it('GET /admin/setup returns incomplete setup initially', async () => {
    const res = await request(app)
      .get('/admin/setup')
      .set('Origin', trustedOrigin)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.complete).toBe(false);
    expect(res.body.data.integrations).toHaveLength(3);
    expect(res.body.data.integrations.find((item: { key: string }) => item.key === 'grafana')).toMatchObject({ configured: true, source: 'env', lastStatus: 'ok' });
    expect(res.body.data.integrations.find((item: { key: string }) => item.key === 'uptime')).toMatchObject({ configured: true, source: 'env', lastStatus: 'ok' });
    expect(res.body.data.integrations.find((item: { key: string }) => item.key === 'mail').configured).toBe(false);
  });

  it('PUT /admin/setup/:key configures integrations and records audit log without secrets', async () => {
    // 1. Configure uptime
    const uptimeRes = await request(app)
      .put('/admin/setup/uptime')
      .set('Origin', trustedOrigin)
      .set('Cookie', adminCookie)
      .send({
        baseUrl: 'http://uptime-kuma:3001',
        apiKey: 'super-secret-kuma-key',
      });

    expect(uptimeRes.status).toBe(200);
    expect(uptimeRes.body.data.configured).toBe(true);
    expect(uptimeRes.body.data.hasCredentials).toBe(true);
    expect(uptimeRes.body.data.credentialHint).toBe('••••-key');

    // 2. Configure grafana
    const grafanaRes = await request(app)
      .put('/admin/setup/grafana')
      .set('Origin', trustedOrigin)
      .set('Cookie', adminCookie)
      .send({
        baseUrl: 'http://grafana:3000',
        apiToken: 'glsa_my_grafana_token_1234',
      });

    expect(grafanaRes.status).toBe(200);
    expect(grafanaRes.body.data.configured).toBe(true);
    expect(grafanaRes.body.data.credentialHint).toBe('••••1234');

    // 3. Configure mail
    const mailRes = await request(app)
      .put('/admin/setup/mail')
      .set('Origin', trustedOrigin)
      .set('Cookie', adminCookie)
      .send({
        host: 'smtp.internal.local',
        port: 587,
        secure: false,
        username: 'mail-user',
        password: 'mail-password-5678',
        fromAddress: 'admin@internal.local',
      });

    expect(mailRes.status).toBe(200);
    expect(mailRes.body.data.configured).toBe(true);
    expect(mailRes.body.data.source).toBe('database');
    expect(mailRes.body.data.credentialHint).toBe('••••5678');
    expect(mailRes.body.data.settings).toEqual({
      host: 'smtp.internal.local',
      port: 587,
      secure: false,
      username: 'mail-user',
      fromAddress: 'admin@internal.local',
    });
    expect(mailRes.body.data.settings.password).toBeUndefined();

    // Check audit logs
    const auditRows = await prisma.auditLog.findMany({
      where: { entity: 'IntegrationConfig' },
    });
    expect(auditRows.length).toBeGreaterThanOrEqual(3);
    for (const log of auditRows) {
      const stringified = JSON.stringify(log.fieldValue);
      expect(stringified).not.toContain('super-secret-kuma-key');
      expect(stringified).not.toContain('glsa_my_grafana_token_1234');
      expect(stringified).not.toContain('mail-password-5678');
    }
  });

  it('rejects SSRF metadata targets in PUT /admin/setup/:key', async () => {
    const res = await request(app)
      .put('/admin/setup/uptime')
      .set('Origin', trustedOrigin)
      .set('Cookie', adminCookie)
      .send({
        baseUrl: 'http://169.254.169.254/metadata',
      });

    expect(res.status).toBe(400);
  });

  it('DELETE /admin/setup/:key clears integration', async () => {
    const res = await request(app)
      .delete('/admin/setup/uptime')
      .set('Origin', trustedOrigin)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.configured).toBe(true);
    expect(res.body.data.source).toBe('env');

    const getRes = await request(app)
      .get('/admin/setup')
      .set('Origin', trustedOrigin)
      .set('Cookie', adminCookie);
    expect(getRes.body.data.complete).toBe(false);
  });
});
