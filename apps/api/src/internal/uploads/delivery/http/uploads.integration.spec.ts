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
import { fileParser } from '../../parser/file-parser.js';
import { buildUploadsRepository } from '../../repository/uploads.js';
import { buildUploadsUseCase } from '../../usecase/uploads.js';
import { createUploadsRouter } from './uploads.js';

describe('clean architecture uploads API', () => {
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
    const owner = await prisma.user.create({ data: { email: 'new-upload-owner@example.com', name: 'Owner' } });
    const other = await prisma.user.create({ data: { email: 'new-upload-other@example.com', name: 'Other' } });
    projectId = (await prisma.project.create({ data: { ownerId: owner.id, name: 'Mine' } })).id;
    foreignProjectId = (await prisma.project.create({ data: { ownerId: other.id, name: 'Theirs' } })).id;
    const projectLookup = async (id: string, userId: string): Promise<boolean> =>
      (await prisma.project.findFirst({ where: { id, ownerId: userId } })) !== null;
    const settingsLookup = async (id: string, userId: string): Promise<{ maxUploadBytes: number; maxRows: number } | null> =>
      prisma.project.findFirst({ where: { id, ownerId: userId }, select: { maxUploadBytes: true, maxRows: true } });
    const useCase = buildUploadsUseCase({
      repository: buildUploadsRepository({ prisma, auditRepository: buildAuditRepository(prisma) }), prisma,
      parser: fileParser, settingsLookup, projectLookup,
    });
    app = express();
    app.use(createUploadsRouter({
      useCase,
      guards: [(req, res, next) => { req.user = { id: owner.id, email: owner.email, role: owner.role }; res.locals.userId = owner.id; next(); }],
    }));
    app.use(errorHandler);
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  it('creates, lists, previews and deletes with audit rows but no row blob in create response or audit', async () => {
    const created = await request(app).post(`/projects/${projectId}/uploads`)
      .attach('file', Buffer.from('name,email\nAda,ada@example.com\nBob,bob@example.com'), 'rows.csv');
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ message: 'Upload created successfully', success: true, data: { fileName: 'rows.csv', rowCount: 2 } });
    expect(created.body.data).not.toHaveProperty('rows');
    const id = (created.body.data as { id: string }).id;
    const stored = await prisma.dataUpload.findUniqueOrThrow({ where: { id } });
    expect(stored.rows).toEqual([{ name: 'Ada', email: 'ada@example.com' }, { name: 'Bob', email: 'bob@example.com' }]);

    const listed = await request(app).get(`/projects/${projectId}/uploads`);
    expect(listed.status).toBe(200);
    expect(listed.body.data[0]).not.toHaveProperty('rows');
    const found = await request(app).get(`/projects/${projectId}/uploads/${id}`);
    expect(found.status).toBe(200);
    expect(found.body.data.preview).toEqual([{ name: 'Ada', email: 'ada@example.com' }, { name: 'Bob', email: 'bob@example.com' }]);

    const createAudit = await prisma.auditLog.findMany({ where: { entity: 'DataUpload', entityId: id, action: 'create' } });
    expect(createAudit.map((entry) => entry.fieldName).sort()).toEqual(['fileName', 'rowCount']);
    expect(JSON.stringify(createAudit)).not.toContain('ada@example.com');

    const deleted = await request(app).delete(`/projects/${projectId}/uploads/${id}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ message: 'Upload deleted successfully', data: null, success: true });
    const deleteAudit = await prisma.auditLog.findMany({ where: { entity: 'DataUpload', entityId: id, action: 'delete' } });
    expect(deleteAudit.map((entry) => entry.fieldName).sort()).toEqual(['fileName', 'rowCount']);
  });

  it('returns 404 for another user’s project and 400 for malformed rows', async () => {
    const foreign = await request(app).post(`/projects/${foreignProjectId}/uploads`)
      .attach('file', Buffer.from('name\nAda'), 'rows.csv');
    expect(foreign.status).toBe(404);
    const malformed = await request(app).post(`/projects/${projectId}/uploads`)
      .attach('file', Buffer.from('name\nAda,private'), 'rows.csv');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('MALFORMED_FILE');
  });
});
