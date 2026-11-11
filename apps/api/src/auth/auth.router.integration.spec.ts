import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startContainer } from '../test-support/start-container.js';
import { buildApp } from '../composition.js';
import { makeSignature } from 'better-auth/crypto';

const trustedOrigin = 'http://localhost:8080';
const authSecret = 'better-auth-secret-long-enough-for-tests';

async function buildSignedSessionCookie(token: string): Promise<string> {
  const signature = await makeSignature(token, authSecret);
  return `better-auth.session_token=${token}.${signature}`;
}

describe('Better Auth HTTP routes', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    container = await startContainer(() => new PostgreSqlContainer('postgres:16').start());
    const connectionString = container.getConnectionUri();
    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--config', 'apps/api/prisma.config.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: connectionString },
      stdio: 'pipe',
    });
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    app = buildApp({
      env: {
        DATABASE_URL: connectionString,
        APP_ENCRYPTION_KEY: 'a'.repeat(64),
        GOOGLE_CLIENT_ID: 'google-client-id',
        GOOGLE_CLIENT_SECRET: 'google-client-secret',
        BETTER_AUTH_SECRET: 'better-auth-secret-long-enough-for-tests',
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
        ADMIN_EMAILS: [],
        PORT: 3000,
      },
      prisma,
    });
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  it('returns a null session when no session cookie is present', async () => {
    const response = await request(app).get('/api/auth/get-session');

    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
  });

  it('starts Google sign-in from a trusted origin and rejects an untrusted origin', async () => {
    const trustedResponse = await request(app)
      .post('/api/auth/sign-in/social')
      .set('Origin', trustedOrigin)
      .send({ provider: 'google', callbackURL: '/' });

    expect(trustedResponse.status).toBe(200);
    expect(trustedResponse.body.url).toMatch(/^https:\/\/accounts\.google\.com\//);

    const untrustedResponse = await request(app)
      .post('/api/auth/sign-in/social')
      .set('Origin', 'https://untrusted.example')
      .send({ provider: 'google', callbackURL: '/' });

    expect(untrustedResponse.status).toBe(403);
  });

  it('rejects credential signup and password reset before writes when platform mail is unavailable', async () => {
    const email = 'smtp-unavailable-signup@example.com';
    const signUpResponse = await request(app)
      .post('/api/auth/sign-up/email')
      .set('Origin', trustedOrigin)
      .send({ name: 'No Mail', email, password: 'long-enough-password' });

    expect(signUpResponse.status).toBe(400);
    expect(signUpResponse.body.code).toBe('EMAIL_UNAVAILABLE');
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();

    const resetResponse = await request(app)
      .post('/api/auth/request-password-reset')
      .set('Origin', trustedOrigin)
      .send({ email: 'unknown-reset@example.com', redirectTo: `${trustedOrigin}/reset-password` });

    expect(resetResponse.status).toBe(400);
    expect(resetResponse.body.code).toBe('EMAIL_UNAVAILABLE');
  });

  it('creates an unverified credential account and emails the frontend verification link when SMTP is available', async () => {
    const sentEmails: { to: string; subject: string; html: string }[] = [];
    const testApp = buildApp({
      env: {
        DATABASE_URL: container.getConnectionUri(),
        APP_ENCRYPTION_KEY: 'a'.repeat(64),
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
        ADMIN_EMAILS: [],
        PORT: 3000,
      },
      prisma,
      authEmailSender: {
        isConfigured: async () => true,
        sendMail: async (message) => {
          sentEmails.push({ to: message.to, subject: message.subject, html: message.html });
          return { ok: true };
        },
      },
    });

    const response = await request(testApp)
      .post('/api/auth/sign-up/email')
      .set('Origin', trustedOrigin)
      .send({
        name: 'Credential User',
        email: 'credential-user@example.com',
        password: 'long-enough-password',
        callbackURL: `${trustedOrigin}/verify-email`,
      });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeNull();
    expect(response.body.user.emailVerified).toBe(false);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].subject).toBe('Verify your email address');
    expect(sentEmails[0].html).toContain(encodeURIComponent(`${trustedOrigin}/verify-email`));
    expect(await prisma.account.findFirst({ where: { userId: response.body.user.id, providerId: 'credential' } })).toMatchObject({
      password: expect.any(String),
    });
  });

  it('rejects /change-email with 400 EMAIL_CHANGE_UNAVAILABLE when auth email sender is not configured', async () => {
    // Create a user in database and an active session
    const user = await prisma.user.create({
      data: {
        email: 'user-change-email-1@example.com',
        name: 'User 1',
      },
    });
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token: 'test-session-token-1',
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });

    const cookie = await buildSignedSessionCookie(session.token);
    const response = await request(app)
      .post('/api/auth/change-email')
      .set('Origin', trustedOrigin)
      .set('Cookie', cookie)
      .send({ newEmail: 'new-email-1@example.com' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('EMAIL_CHANGE_UNAVAILABLE');
  });

  it('allows /change-email and sends verification email with token when auth email sender is configured', async () => {
    const sentEmails: { to: string; subject: string; html: string }[] = [];
    const testApp = buildApp({
      env: {
        DATABASE_URL: container.getConnectionUri(),
        APP_ENCRYPTION_KEY: 'a'.repeat(64),
        GOOGLE_CLIENT_ID: 'google-client-id',
        GOOGLE_CLIENT_SECRET: 'google-client-secret',
        BETTER_AUTH_SECRET: 'better-auth-secret-long-enough-for-tests',
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
        ADMIN_EMAILS: [],
        PORT: 3000,
      },
      prisma,
      authEmailSender: {
        sendMail: async (msg) => {
          sentEmails.push(msg);
          return { ok: true };
        },
      },
    });

    const user = await prisma.user.create({
      data: {
        email: 'user-change-email-2@example.com',
        name: 'User 2',
      },
    });
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token: 'test-session-token-2',
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });

    const cookie = await buildSignedSessionCookie(session.token);
    const response = await request(testApp)
      .post('/api/auth/change-email')
      .set('Origin', trustedOrigin)
      .set('Cookie', cookie)
      .send({ newEmail: 'new-email-2@example.com' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe(true);

    // Old email should still be intact in user record before verification
    const refreshedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(refreshedUser?.email).toBe('user-change-email-2@example.com');

    // Email should have been sent to newEmail
    expect(sentEmails.length).toBe(1);
    expect(sentEmails[0].to).toBe('new-email-2@example.com');
    expect(sentEmails[0].subject).toContain('Verify');

    // Extract token from verification URL
    const tokenMatch = /token=([^&"'\s]+)/.exec(sentEmails[0].html);
    expect(tokenMatch).not.toBeNull();
    const token = decodeURIComponent(tokenMatch![1]);

    // Verify email using token
    const verifyRes = await request(testApp)
      .get(`/api/auth/verify-email?token=${token}&callbackURL=${encodeURIComponent('/profile')}`)
      .set('Origin', trustedOrigin);

    expect(verifyRes.status).toBe(302); // Redirect to callbackURL

    // Now user email should be updated in database
    const verifiedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(verifiedUser?.email).toBe('new-email-2@example.com');
  });
});
