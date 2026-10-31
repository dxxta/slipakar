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
import { buildPdfTemplatesRepository } from '../../repository/pdf-templates.js';
import { buildPdfTemplatesUseCase } from '../../usecase/pdf-templates.js';
import { createPdfTemplatesRouter } from './pdf-templates.js';

describe('PDF templates HTTP delivery integration', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let app: express.Express;
  let projectId: string;
  let attachmentId: string;

  const validTree = {
    page: { size: 'A4', margin: 10 },
    nodes: [
      {
        id: 'node-text',
        type: 'text',
        x: 10,
        y: 10,
        width: 100,
        height: 20,
        content: 'Invoice {{invoice_num}}',
        style: { fontSize: 12, bold: false, align: 'left', color: '#000000' },
      },
    ],
  };

  beforeAll(async () => {
    container = await startContainer(() => new PostgreSqlContainer('postgres:16').start());
    const connectionString = container.getConnectionUri();
    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--config', 'apps/api/prisma.config.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: connectionString },
      stdio: 'pipe',
    });
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    const owner = await prisma.user.create({ data: { email: 'pdf-owner@example.com', name: 'Owner' } });
    projectId = (await prisma.project.create({ data: { ownerId: owner.id, name: 'PDF Proj' } })).id;

    // Create an attachment in the project for image testing
    const att = await prisma.attachment.create({
      data: {
        projectId,
        fileName: 'logo.png',
        objectKey: `${projectId}/uuid/logo.png`,
        sizeBytes: 1000n,
        kind: 'extra',
      },
    });
    attachmentId = att.id;

    const projectLookup = async (id: string, userId: string): Promise<boolean> =>
      (await prisma.project.findFirst({ where: { id, ownerId: userId } })) !== null;

    const attachmentLookup = async (pId: string, aId: string): Promise<boolean> =>
      (await prisma.attachment.findFirst({ where: { projectId: pId, id: aId } })) !== null;

    const useCase = buildPdfTemplatesUseCase({
      repository: buildPdfTemplatesRepository({ prisma, auditRepository: buildAuditRepository(prisma) }),
      prisma,
      projectLookup,
      attachmentLookup,
    });

    app = express();
    app.use(express.json());
    app.use(createPdfTemplatesRouter({
      useCase,
      guards: [
        (req, res, next) => {
          req.user = { id: owner.id, email: owner.email, role: owner.role };
          res.locals.userId = owner.id;
          next();
        },
      ],
    }));
    app.use(errorHandler);
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  it('creates, lists, gets, updates and deletes a PDF template', async () => {
    // 1. Create
    const createRes = await request(app)
      .post(`/projects/${projectId}/pdf-templates`)
      .send({ name: 'Standard Payslip', nodeTree: validTree });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({
      message: 'PDF template created successfully',
      success: true,
      data: { name: 'Standard Payslip' },
    });

    const id = createRes.body.data.id as string;

    // 2. List
    const listRes = await request(app).get(`/projects/${projectId}/pdf-templates`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].id).toBe(id);

    // 3. Get one
    const getRes = await request(app).get(`/projects/${projectId}/pdf-templates/${id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(id);

    // 4. Update
    const patchRes = await request(app)
      .patch(`/projects/${projectId}/pdf-templates/${id}`)
      .send({ name: 'Updated Payslip Name' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.name).toBe('Updated Payslip Name');

    // 5. Delete
    const deleteRes = await request(app).delete(`/projects/${projectId}/pdf-templates/${id}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body).toEqual({
      message: 'PDF template deleted successfully',
      data: null,
      success: true,
    });

    // 6. Confirm deleted
    const getAfterDelete = await request(app).get(`/projects/${projectId}/pdf-templates/${id}`);
    expect(getAfterDelete.status).toBe(404);
  });

  it('allows image node when attachmentId exists in project', async () => {
    const treeWithImg = {
      page: { size: 'A4', margin: 10 },
      nodes: [
        {
          id: 'img-node',
          type: 'image',
          x: 10,
          y: 10,
          width: 50,
          height: 50,
          attachmentId,
        },
      ],
    };

    const res = await request(app)
      .post(`/projects/${projectId}/pdf-templates`)
      .send({ name: 'Template with Image', nodeTree: treeWithImg });

    expect(res.status).toBe(201);
  });
});
