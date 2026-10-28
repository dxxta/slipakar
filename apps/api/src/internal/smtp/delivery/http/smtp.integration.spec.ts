import { startContainer } from '../../../../test-support/start-container.js';
import { execFileSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildAuditRepository } from '../../../audit/repository/audit.js';
import { errorHandler } from '../../../../middleware/error-handler.js';
import { createCryptoService } from '../../../../services/crypto.js';
import { buildSmtpRepository } from '../../repository/smtp.js';
import { buildSmtpSender } from '../../sender/smtp-sender.js';
import { buildSmtpUseCase } from '../../usecase/smtp.js';
import { createSmtpRouter } from './smtp.js';

describe('new SMTP HTTP resource', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let app: express.Express;
  let projectId: string;
  let foreignProjectId: string;

  beforeAll(async () => {
    container = await startContainer(() => new PostgreSqlContainer('postgres:16').start());
    const connectionString = container.getConnectionUri();
    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--config', 'apps/api/prisma.config.ts'], {
      cwd: process.cwd(), env: { ...process.env, DATABASE_URL: connectionString }, stdio: 'pipe',
    });
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    const owner = await prisma.user.create({ data: { email: 'new-smtp-owner@example.com', name: 'Owner' } });
    const other = await prisma.user.create({ data: { email: 'new-smtp-other@example.com', name: 'Other' } });
    projectId = (await prisma.project.create({ data: { ownerId: owner.id, name: 'Mine' } })).id;
    foreignProjectId = (await prisma.project.create({ data: { ownerId: other.id, name: 'Theirs' } })).id;
    const useCase = buildSmtpUseCase({
      repository: buildSmtpRepository({ prisma, auditRepository: buildAuditRepository(prisma) }), prisma,
      cryptoService: createCryptoService('a'.repeat(64)),
      sender: buildSmtpSender(() => ({ verify: async () => true })),
      projectLookup: async (id, userId) => (await prisma.project.findFirst({ where: { id, ownerId: userId } })) !== null,
    });
    app = express();
    app.use(express.json());
    app.use(createSmtpRouter({ guards: [(req, res, next) => {
      req.user = { id: owner.id, email: owner.email, role: owner.role };
      res.locals.userId = owner.id;
      next();
    }], useCase }));
    app.use(errorHandler);
  }, 120_000);

  afterAll(async () => { await prisma?.$disconnect(); await container?.stop(); }, 120_000);

  it('creates, reads, tests, updates, and deletes with audits and no leaked password', async () => {
    const password = 'private-smtp-password';
    const base = `/projects/${projectId}/smtp`;
    const created = await request(app).post(base).send({ host: 'smtp.example.com', port: 587, username: 'sender', password, secure: false, fromAddress: 'sender@example.com' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ success: true, message: 'SMTP connection created successfully' });
    expect(created.body.data.fromAddress).toBe('sender@example.com');
    const id = created.body.data.id as string;
    expect(JSON.stringify(created.body)).not.toContain(password);
    expect(created.body.data).not.toHaveProperty('passwordEncrypted');
    const stored = await prisma.smtpConnection.findUniqueOrThrow({ where: { id } });
    expect(stored.passwordEncrypted).not.toBe(password);
    expect((await request(app).get(base)).body.data).toHaveLength(1);
    expect((await request(app).get(`${base}/${id}`)).body.data.id).toBe(id);
    expect((await request(app).post(`${base}/${id}/test`)).body.data).toEqual({ ok: true });
    const updated = await request(app).patch(`${base}/${id}`).send({ username: 'new-sender', password: 'new-private-password' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.username).toBe('new-sender');
    expect(JSON.stringify(updated.body)).not.toContain('new-private-password');
    await request(app).patch(`${base}/${id}`).send({ password: 'rotation-only-secret' });
    expect((await request(app).delete(`${base}/${id}`)).body).toMatchObject({ success: true, data: null });
    expect((await request(app).get(`${base}/${id}`)).status).toBe(404);
    const audits = await prisma.auditLog.findMany({ where: { entity: 'SmtpConnection', entityId: id } });
    expect(new Set(audits.map((audit) => audit.action))).toEqual(new Set(['create', 'update', 'delete']));
    expect(JSON.stringify(audits)).not.toContain(password);
    expect(JSON.stringify(audits)).not.toContain('new-private-password');
    expect(JSON.stringify(audits)).not.toContain('rotation-only-secret');
    expect(audits.some((audit) => audit.fieldName === 'credentialsUpdated')).toBe(true);
  });

  it('returns 404 for another user’s project', async () => {
    const response = await request(app).get(`/projects/${foreignProjectId}/smtp`);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
