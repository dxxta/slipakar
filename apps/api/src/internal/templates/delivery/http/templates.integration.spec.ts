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
import { buildTemplatesRepository } from '../../repository/templates.js';
import { buildTemplatesUseCase } from '../../usecase/templates.js';
import { createTemplatesRouter } from './templates.js';

describe('new templates HTTP resource', () => {
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
    const owner = await prisma.user.create({ data: { email: 'new-template-owner@example.com', name: 'Owner' } });
    const other = await prisma.user.create({ data: { email: 'new-template-other@example.com', name: 'Other' } });
    projectId = (await prisma.project.create({ data: { ownerId: owner.id, name: 'Mine' } })).id;
    foreignProjectId = (await prisma.project.create({ data: { ownerId: other.id, name: 'Theirs' } })).id;
    const useCase = buildTemplatesUseCase({
      repository: buildTemplatesRepository({ prisma, auditRepository: buildAuditRepository(prisma) }), prisma,
      projectLookup: async (id, userId) => (await prisma.project.findFirst({ where: { id, ownerId: userId } })) !== null,
    });
    app = express();
    app.use(express.json());
    app.use(createTemplatesRouter({ guards: [(req, res, next) => {
      req.user = { id: owner.id, email: owner.email, role: owner.role };
      res.locals.userId = owner.id;
      next();
    }], useCase }));
    app.use(errorHandler);
  }, 120_000);

  afterAll(async () => { await prisma?.$disconnect(); await container?.stop(); }, 120_000);

  it('creates, lists, reads, updates, and deletes with audit rows', async () => {
    const base = `/projects/${projectId}/templates`;
    const created = await request(app).post(base).send({ name: 'Payslip', subject: 'Hello {{name}}', bodyHtml: '<p>{{name}}</p>' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ success: true, message: 'Template created successfully' });
    const id = created.body.data.id as string;
    expect((await request(app).get(base)).body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
    expect((await request(app).get(`${base}/${id}`)).body.data.subject).toBe('Hello {{name}}');
    expect((await request(app).patch(`${base}/${id}`).send({ name: 'Updated' })).body.data.name).toBe('Updated');
    expect((await request(app).patch(`${base}/${id}`).send({ bodyHtml: '<div>Revised</div>' })).body.data.bodyHtml).toBe('<div>Revised</div>');
    expect((await request(app).delete(`${base}/${id}`)).body).toMatchObject({ success: true, data: null });
    expect((await request(app).get(`${base}/${id}`)).status).toBe(404);
    const audits = await prisma.auditLog.findMany({ where: { entity: 'EmailTemplate', entityId: id } });
    expect(new Set(audits.map((audit) => audit.action))).toEqual(new Set(['create', 'update', 'delete']));
    expect(audits.some((audit) => audit.fieldName === 'bodyHtml')).toBe(false);
    expect(audits.some((audit) => audit.fieldName === 'bodyHtmlUpdated')).toBe(true);
  });

  it('rejects unsafe syntax and another user’s project', async () => {
    const unsafe = await request(app).post(`/projects/${projectId}/templates`).send({ name: 'Unsafe', subject: 'Hello', bodyHtml: '{{#each rows}}' });
    expect(unsafe.status).toBe(400);
    expect(unsafe.body.error.code).toBe('UNSAFE_TEMPLATE');
    const foreign = await request(app).get(`/projects/${foreignProjectId}/templates`);
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.code).toBe('NOT_FOUND');
  });
});
