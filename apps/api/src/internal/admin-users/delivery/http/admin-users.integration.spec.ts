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
import { buildAdminUsersRepository } from '../../repository/admin-users.js';
import { buildAdminUsersUseCase } from '../../usecase/admin-users.js';
import { createAdminUsersRouter } from './admin-users.js';
import { requireAdmin } from '../../../system-config/middleware/require-admin.js';

describe('Admin Users Integration Tests', () => {
  let pgContainer: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let app: express.Express;

  const adminEmail = 'admin@example.com';
  const otherAdminEmail = 'second-admin@example.com';
  let adminId: string;
  let regularUserId: string;

  beforeAll(async () => {
    pgContainer = await startContainer(() => new PostgreSqlContainer('postgres:16').start());
    const pgConn = pgContainer.getConnectionUri();

    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--config', 'apps/api/prisma.config.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: pgConn },
      stdio: 'pipe',
    });

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: pgConn }) });

    const auditRepository = buildAuditRepository(prisma);
    const repository = buildAdminUsersRepository({ prisma, auditRepository });
    const useCase = buildAdminUsersUseCase({
      repository,
      prisma,
      adminEmails: [adminEmail, otherAdminEmail],
    });

    app = express();
    app.use(express.json());
    app.use(
      createAdminUsersRouter({
        guards: [
          (req, res, next) => {
            const emailHeader = (req.headers['x-test-email'] as string) || adminEmail;
            req.user = { id: adminId, email: emailHeader, role: 'admin' };
            res.locals.userId = adminId;
            next();
          },
          requireAdmin([adminEmail, otherAdminEmail]),
        ],
        useCase,
      }),
    );
    app.use(errorHandler);

    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Admin User',
        role: 'admin',
        emailVerified: true,
      },
    });
    adminId = admin.id;

    await prisma.user.create({
      data: {
        email: otherAdminEmail,
        name: 'Second Admin',
        role: 'admin',
        emailVerified: true,
      },
    });

    const regular = await prisma.user.create({
      data: {
        email: 'regular@example.com',
        name: 'Regular User',
        role: 'user',
        emailVerified: false,
      },
    });
    regularUserId = regular.id;

    // Create a project for regular user to test projectCount
    await prisma.project.create({
      data: {
        name: 'Regular Project',
        ownerId: regularUserId,
      },
    });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await pgContainer?.stop();
  });

  it('GET /admin/users lists users with projectCount, search, pagination', async () => {
    const res = await request(app).get('/admin/users?page=1&limit=10&sortBy=createdAt&sortDir=desc');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    const regularItem = res.body.data.find((u: { id: string }) => u.id === regularUserId);
    expect(regularItem).toBeDefined();
    expect(regularItem.projectCount).toBe(1);
    expect(regularItem.disabledAt).toBeNull();
  });

  it('GET /admin/users/:id returns user details', async () => {
    const res = await request(app).get(`/admin/users/${regularUserId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(regularUserId);
    expect(res.body.data.email).toBe('regular@example.com');
    expect(res.body.data.projectCount).toBe(1);
  });

  it('PATCH /admin/users/:id updates name/image but rejects email', async () => {
    const rejectRes = await request(app)
      .patch(`/admin/users/${regularUserId}`)
      .send({ email: 'hacked@example.com' });
    expect(rejectRes.status).toBe(400);

    const okRes = await request(app)
      .patch(`/admin/users/${regularUserId}`)
      .send({ name: 'Regular Renamed' });
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.name).toBe('Regular Renamed');

    const inDb = await prisma.user.findUnique({ where: { id: regularUserId } });
    expect(inDb?.name).toBe('Regular Renamed');
    expect(inDb?.email).toBe('regular@example.com');

    // Relative uploaded avatar path round-trip succeeds
    const avatarPath = `/me/avatar/${regularUserId}?v=a1b2c3d4`;
    const relAvatarRes = await request(app)
      .patch(`/admin/users/${regularUserId}`)
      .send({ name: 'Regular With Avatar', image: avatarPath });
    expect(relAvatarRes.status).toBe(200);
    expect(relAvatarRes.body.data.image).toBe(avatarPath);

    // Absolute https URL succeeds
    const httpsAvatarRes = await request(app)
      .patch(`/admin/users/${regularUserId}`)
      .send({ image: 'https://example.com/avatar.png' });
    expect(httpsAvatarRes.status).toBe(200);
    expect(httpsAvatarRes.body.data.image).toBe('https://example.com/avatar.png');

    // Null image clears avatar
    const clearAvatarRes = await request(app)
      .patch(`/admin/users/${regularUserId}`)
      .send({ image: null });
    expect(clearAvatarRes.status).toBe(200);
    expect(clearAvatarRes.body.data.image).toBeNull();

    // Arbitrary relative paths, http://, javascript:, data:, or >2048 chars are rejected with 400
    for (const badImage of [
      '/other/relative/path.png',
      '/me/avatar/../admin?v=deadbeef',
      '/me/avatar/user1?v=xyz_not_hex',
      'http://example.com/insecure.png',
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      `https://example.com/${'a'.repeat(2050)}`,
    ]) {
      const badRes = await request(app)
        .patch(`/admin/users/${regularUserId}`)
        .send({ image: badImage });
      expect(badRes.status).toBe(400);
    }
  });

  it('POST /admin/users/:id/disable disables user, revokes sessions, and logs audit', async () => {
    // Add a session for regular user
    await prisma.session.create({
      data: {
        userId: regularUserId,
        token: 'active-session-token',
        expiresAt: new Date(Date.now() + 100000),
      },
    });

    const res = await request(app)
      .post(`/admin/users/${regularUserId}/disable`)
      .send({ reason: 'Violated terms' });

    expect(res.status).toBe(200);
    expect(res.body.data.disabledAt).not.toBeNull();

    // Verify session revoked
    const sessions = await prisma.session.findMany({ where: { userId: regularUserId } });
    expect(sessions.length).toBe(0);

    // Verify audit log
    const auditLogs = await prisma.auditLog.findMany({
      where: { entity: 'User', entityId: regularUserId },
    });
    expect(auditLogs.some((l) => l.fieldName === 'disabledAt')).toBe(true);
  });

  it('POST /admin/users/:id/enable re-enables user', async () => {
    const res = await request(app).post(`/admin/users/${regularUserId}/enable`).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.disabledAt).toBeNull();

    const inDb = await prisma.user.findUnique({ where: { id: regularUserId } });
    expect(inDb?.disabledAt).toBeNull();
  });

  it('rejects an admin disabling themselves', async () => {
    const res = await request(app).post(`/admin/users/${adminId}/disable`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_DISABLE_SELF');
  });
});
