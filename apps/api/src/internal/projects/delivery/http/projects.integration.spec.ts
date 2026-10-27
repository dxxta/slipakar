import { startContainer } from '../../../../test-support/start-container.js';
import { execFileSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildAuditRepository } from '../../../audit/repository/audit.js';
import { errorHandler } from '../../../../middleware/error-handler.js';
import { buildProjectsRepository } from '../../repository/projects.js';
import { buildProjectsUseCase } from '../../usecase/projects.js';
import { createProjectsRouter } from './projects.js';

describe('clean projects API', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let app: express.Express;
  let ownerId: string;
  let otherId: string;

  beforeAll(async () => {
    container = await startContainer(() => new PostgreSqlContainer('postgres:16').start());
    const connectionString = container.getConnectionUri();
    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--config', 'apps/api/prisma.config.ts'], {
      cwd: process.cwd(), env: { ...process.env, DATABASE_URL: connectionString }, stdio: 'pipe',
    });
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    ownerId = (await prisma.user.create({ data: { email: 'new-project-owner@example.com', name: 'Owner' } })).id;
    otherId = (await prisma.user.create({ data: { email: 'new-project-other@example.com', name: 'Other' } })).id;
    const guard: RequestHandler = (req, res, next): void => {
      res.locals.userId = req.headers['x-test-user'] === 'other' ? otherId : ownerId;
      next();
    };
    app = express();
    app.use(express.json());
    app.use(createProjectsRouter({ guards: [guard], useCase: buildProjectsUseCase({
      repository: buildProjectsRepository({ prisma, auditRepository: buildAuditRepository(prisma) }), prisma,
    }) }));
    app.use(errorHandler);
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  it('creates, lists, reads, updates, and deletes with response envelopes and audit rows', async () => {
    const created = await request(app).post('/projects').send({ name: ' Payroll ' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ message: 'Project created successfully', success: true, data: { name: 'Payroll', storageQuotaBytes: '1073741824' } });
    const id = created.body.data.id as string;
    const listRes = await request(app).get('/projects?page=1&limit=10&q=Pay');
    expect(listRes.status).toBe(200);
    expect(listRes.body).toMatchObject({
      message: 'Projects retrieved successfully',
      success: true,
      metadata: { page: 1, limit: 10, total: 1 },
    });
    expect(listRes.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
    expect((await request(app).get(`/projects/${id}`)).body.data.id).toBe(id);
    const updated = await request(app).patch(`/projects/${id}`).send({ name: 'Updated', maxRows: 250 });
    expect(updated.body).toMatchObject({ success: true, data: { name: 'Updated', maxRows: 250 } });
    expect((await request(app).delete(`/projects/${id}`)).status).toBe(200);
    expect((await request(app).get(`/projects/${id}`)).status).toBe(404);
    const actions = (await prisma.auditLog.findMany({ where: { entity: 'Project', entityId: id } })).map((row) => row.action);
    expect(actions).toContain('create');
    expect(actions).toContain('update');
    expect(actions).toContain('delete');
    expect(JSON.stringify(created.body)).not.toContain('passwordEncrypted');
  });

  it('returns 404 for another owner and rejects an empty patch', async () => {
    const foreign = await prisma.project.create({ data: { ownerId: otherId, name: 'Private' } });
    expect((await request(app).get(`/projects/${foreign.id}`)).status).toBe(404);
    expect((await request(app).patch(`/projects/${foreign.id}`).send({ name: 'Changed' })).status).toBe(404);
    expect((await request(app).delete(`/projects/${foreign.id}`)).status).toBe(404);
    const own = await request(app).post('/projects').send({ name: 'Patch target' });
    const empty = await request(app).patch(`/projects/${own.body.data.id as string}`).send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION');
  });
});
