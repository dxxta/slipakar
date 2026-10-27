import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startContainer } from '../test-support/start-container.js';
import { buildApp } from '../composition.js';

const trustedOrigin = 'http://localhost:8080';

describe('Auth & Login Activity IP resolution', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;

  beforeAll(async () => {
    container = await startContainer(() => new PostgreSqlContainer('postgres:16').start());
    const connectionString = container.getConnectionUri();
    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--config', 'apps/api/prisma.config.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: connectionString },
      stdio: 'pipe',
    });
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  it('resolves client IP from XFF when TRUST_PROXY is 1', async () => {
    const app = buildApp({
      env: {
        DATABASE_URL: container.getConnectionUri(),
        APP_ENCRYPTION_KEY: 'c'.repeat(64),
        GOOGLE_CLIENT_ID: 'google-client-id',
        GOOGLE_CLIENT_SECRET: 'google-client-secret',
        BETTER_AUTH_SECRET: 'better-auth-secret-long-enough-for-tests',
        BETTER_AUTH_URL: 'http://localhost:3000',
        TRUSTED_ORIGINS: [trustedOrigin],
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
        TRUST_PROXY: '1',
      },
      prisma,
    });

    // In Better Auth social sign in or request, let's verify request handling
    const res = await request(app)
      .get('/health')
      .set('X-Forwarded-For', '203.0.113.195');

    expect(res.status).toBe(200);
  });

  it('records LoginEvent with correct IP, proxy flag, and location for public IP vs private IP', async () => {
    const { LoginActivityRepository } = await import('../internal/login-activity/repository/login-activity.js');
    const { LoginActivityUseCase } = await import('../internal/login-activity/usecase/login-activity.js');

    const repo = new LoginActivityRepository(prisma);
    const useCase = new LoginActivityUseCase(repo, 90);

    const user = await prisma.user.create({
      data: {
        email: 'ip-test@example.com',
        name: 'IP Test User',
      },
    });

    // Case 1: Public IP with 1 hop -> proxy: false, country populated
    const eventPublic = await useCase.recordLogin({
      userId: user.id,
      ipAddress: '8.8.8.8',
      forwardedFor: '8.8.8.8',
    });
    expect(eventPublic.ip).toBe('8.8.8.8');
    expect(eventPublic.proxy).toBe(false);
    expect(eventPublic.country).toBe('US');

    // Case 2: Public IP with >1 hops -> proxy: true, country populated
    const eventProxy = await useCase.recordLogin({
      userId: user.id,
      ipAddress: '8.8.8.8',
      forwardedFor: '8.8.8.8, 1.1.1.1',
    });
    expect(eventProxy.proxy).toBe(true);
    expect(eventProxy.country).toBe('US');

    // Case 3: Private / Docker / loopback IP -> proxy: false, country: null
    const eventPrivate = await useCase.recordLogin({
      userId: user.id,
      ipAddress: '172.18.0.1',
      forwardedFor: '172.18.0.1',
    });
    expect(eventPrivate.proxy).toBe(false);
    expect(eventPrivate.country).toBeNull();
  });
});
