import { startContainer } from '../../../../test-support/start-container.js';
import { execFileSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildAuditRepository } from '../../repository/audit.js';
import { buildAuditUseCase } from '../../usecase/audit.js';
import { createAuditRouter } from './audit.js';
import { errorHandler } from '../../../../middleware/error-handler.js';

describe('Audit Activity API', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let app: express.Express;
  let ownerId: string;
  let otherId: string;
  let projectId: string;

  beforeAll(async () => {
    container = await startContainer(() => new PostgreSqlContainer('postgres:16').start());
    const connectionString = container.getConnectionUri();
    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--config', 'apps/api/prisma.config.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: connectionString },
      stdio: 'pipe',
    });
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    ownerId = (await prisma.user.create({ data: { email: 'activity-owner@example.com', name: 'Owner' } })).id;
    otherId = (await prisma.user.create({ data: { email: 'activity-other@example.com', name: 'Other' } })).id;

    const project = await prisma.project.create({
      data: { name: 'Audit Test Project', ownerId },
    });
    projectId = project.id;

    const auditRepo = buildAuditRepository(prisma);
    await auditRepo.createAuditRepository({
      entity: 'Project',
      entityId: projectId,
      action: 'create',
      auditUserId: ownerId,
      changes: [{ fieldName: 'name', fieldValue: 'Audit Test Project' }],
    });
    await auditRepo.createAuditRepository({
      entity: 'SmtpConnection',
      entityId: 'smtp-1',
      action: 'create',
      auditUserId: ownerId,
      changes: [{ fieldName: 'passwordEncrypted', fieldValue: 'secret-pass' }],
    });
    await auditRepo.createAuditRepository({
      entity: 'EmailTemplate',
      entityId: 'tpl-1',
      action: 'create',
      auditUserId: ownerId,
      changes: [{ fieldName: 'subject', fieldValue: 'Welcome!' }],
    });
    // Create template referencing projectId so findActivityByProjectRepository joins it
    await prisma.emailTemplate.create({
      data: {
        id: 'tpl-1',
        projectId,
        name: 'Tpl 1',
        subject: 'Welcome!',
        bodyHtml: '<p>Hi</p>',
      },
    });

    const guard: RequestHandler = (req, res, next): void => {
      res.locals.userId = req.headers['x-test-user'] === 'other' ? otherId : ownerId;
      next();
    };

    app = express();
    app.use(express.json());
    app.use(
      createAuditRouter({
        guards: [guard],
        useCase: buildAuditUseCase({
          repository: auditRepo,
          prisma,
          projectLookup: async (pId, uId) => {
            const p = await prisma.project.findFirst({ where: { id: pId, ownerId: uId } });
            return Boolean(p);
          },
        }),
      }),
    );
    app.use(errorHandler);
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  it('lists paginated activity for project owner and redacts sensitive field values', async () => {
    const res = await request(app).get(`/projects/${projectId}/activity?page=1&limit=10`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      message: 'Project activity retrieved successfully',
      success: true,
      metadata: {
        page: 1,
        limit: 10,
        total: 2, // Project create + EmailTemplate create (smtp-1 is not linked to this project)
      },
    });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    // Ensure sensitive field values are never exposed
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('secret-pass');
  });

  it('returns 404 when requested by a non-owner', async () => {
    const res = await request(app)
      .get(`/projects/${projectId}/activity`)
      .set('x-test-user', 'other');
    expect(res.status).toBe(404);
  });
});
