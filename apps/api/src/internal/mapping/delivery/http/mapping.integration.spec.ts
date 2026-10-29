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
import { extractPlaceholders, renderTemplate } from '../../../templates/renderer/template-renderer.js';
import { buildMappingRepository } from '../../repository/mapping.js';
import { buildMappingUseCase } from '../../usecase/mapping.js';
import { createMappingRouter } from './mapping.js';

describe('clean mapping API', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let app: express.Express;
  let projectId: string;
  let foreignProjectId: string;
  let templateId: string;
  let uploadId: string;

  beforeAll(async () => {
    container = await startContainer(() => new PostgreSqlContainer('postgres:16').start());
    const connectionString = container.getConnectionUri();
    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--config', 'apps/api/prisma.config.ts'], {
      cwd: process.cwd(), env: { ...process.env, DATABASE_URL: connectionString }, stdio: 'pipe',
    });
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    const owner = await prisma.user.create({ data: { email: 'clean-mapping-owner@example.com', name: 'Owner' } });
    const other = await prisma.user.create({ data: { email: 'clean-mapping-other@example.com', name: 'Other' } });
    projectId = (await prisma.project.create({ data: { ownerId: owner.id, name: 'Payroll' } })).id;
    foreignProjectId = (await prisma.project.create({ data: { ownerId: other.id, name: 'Private' } })).id;
    templateId = (await prisma.emailTemplate.create({ data: { projectId, name: 'Greeting', subject: 'Hello {{name}}', bodyHtml: '<p>{{name}}</p>' } })).id;
    uploadId = (await prisma.dataUpload.create({ data: { projectId, fileName: 'rows.json', columns: ['first', 'second'], rows: [{ first: 'Ada', second: '<Lin>' }], rowCount: 1 } })).id;
    const guard: RequestHandler = (_req, res, next): void => { res.locals.userId = owner.id; next(); };
    const useCase = buildMappingUseCase({
      repository: buildMappingRepository({ prisma, auditRepository: buildAuditRepository(prisma) }), prisma,
      engine: { extractPlaceholders, renderTemplate },
      projectLookup: async (id, userId) => Boolean(await prisma.project.findFirst({ where: { id, ownerId: userId } })),
      templateLookup: async (id, tid) => prisma.emailTemplate.findFirst({ where: { id: tid, projectId: id } }),
      uploadLookup: async (id, uid) => {
        const upload = await prisma.dataUpload.findFirst({ where: { id: uid, projectId: id } });
        return upload ? { columns: upload.columns as string[], rowCount: upload.rowCount } : null;
      },
      rowLookup: async (id, uid, row) => {
        const upload = await prisma.dataUpload.findFirst({ where: { id: uid, projectId: id } });
        return (upload?.rows as Record<string, string>[] | undefined)?.[row] ?? null;
      },
    });
    app = express();
    app.use(express.json());
    app.use(createMappingRouter({ guards: [guard], useCase }));
    app.use(errorHandler);
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  it('upserts a mapping, previews it, and audits create and update', async () => {
    const url = `/projects/${projectId}/mappings`;
    const ids = { templateId, uploadId };
    const first = await request(app).put(url).send({ ...ids, mapping: { name: 'first' } });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ message: 'Mapping saved successfully', success: true, data: { mapping: { name: 'first' } } });
    const second = await request(app).put(url).send({ ...ids, mapping: { name: 'second' } });
    expect(second.body.data.mapping).toEqual({ name: 'second' });
    expect(await prisma.fieldMapping.count({ where: ids })).toBe(1);
    expect((await request(app).get(url).query(ids)).body.data.mapping).toEqual({ name: 'second' });
    const preview = await request(app).post(`/projects/${projectId}/preview`).send({ ...ids, row: 0 });
    expect(preview.body.data).toEqual({ subject: 'Hello <Lin>', body: '<p>&lt;Lin&gt;</p>', row: 0 });
    const actions = (await prisma.auditLog.findMany({ where: { entity: 'FieldMapping', entityId: second.body.data.id as string } })).map((row) => row.action);
    expect(actions).toEqual(['create', 'update']);
  });

  it('returns MAPPING_INVALID details and hides a foreign project', async () => {
    const invalid = await request(app).put(`/projects/${projectId}/mappings`).send({ templateId, uploadId, mapping: {} });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toMatchObject({ code: 'MAPPING_INVALID', details: { unmapped: ['name'], unknownColumns: [] } });
    const foreign = await request(app).get(`/projects/${foreignProjectId}/mappings`).query({ templateId, uploadId });
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.code).toBe('NOT_FOUND');
  });
});
