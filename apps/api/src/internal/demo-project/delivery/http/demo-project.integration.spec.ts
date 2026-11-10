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
import { buildProjectsRepository } from '../../../projects/repository/projects.js';
import { buildTemplatesRepository } from '../../../templates/repository/templates.js';
import { buildUploadsRepository } from '../../../uploads/repository/uploads.js';
import { buildUploadsUseCase } from '../../../uploads/usecase/uploads.js';
import { buildMappingRepository } from '../../../mapping/repository/mapping.js';
import { buildMappingUseCase } from '../../../mapping/usecase/mapping.js';
import { buildPdfTemplatesRepository } from '../../../pdf-templates/repository/pdf-templates.js';
import { buildCampaignsRepository } from '../../../campaigns/repository/campaigns.js';
import { buildSmtpRepository } from '../../../smtp/repository/smtp.js';
import { buildSmtpUseCase } from '../../../smtp/usecase/smtp.js';
import { fileParser } from '../../../uploads/parser/file-parser.js';
import { createCryptoService } from '../../../../services/crypto.js';
import { buildDemoProjectUseCase } from '../../usecase/demo-project.js';
import { createDemoProjectRouter } from './demo-project.js';
import { requireAdmin } from '../../../system-config/middleware/require-admin.js';
import { seedSystemDemoProject } from '../../startup-seed.js';
import type { ErrorReporter } from '../../../../domain/error-reporting/interface.js';

describe('Demo Project Integration', () => {
  let pgContainer: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let app: express.Express;

  const adminEmail = 'admin-demo@example.com';
  let adminId: string;
  let demoProjectUseCase: ReturnType<typeof buildDemoProjectUseCase>;

  beforeAll(async () => {
    pgContainer = await startContainer(() => new PostgreSqlContainer('postgres:16').start());
    const pgConn = pgContainer.getConnectionUri();

    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--config', 'apps/api/prisma.config.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: pgConn },
      stdio: 'pipe',
    });

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: pgConn }) });

    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Demo Admin',
        role: 'admin',
        emailVerified: true,
      },
    });
    adminId = admin.id;

    const cryptoService = createCryptoService('a'.repeat(64));
    const auditRepository = buildAuditRepository(prisma);
    const projectsRepository = buildProjectsRepository({ prisma, auditRepository });
    const templatesRepository = buildTemplatesRepository({ prisma, auditRepository });
    const uploadsRepository = buildUploadsRepository({ prisma, auditRepository });
    const uploadsUseCase = buildUploadsUseCase({
      repository: uploadsRepository,
      prisma,
      parser: fileParser,
      settingsLookup: async (pid, uid) => {
        const p = await prisma.project.findFirst({ where: { id: pid, ownerId: uid } });
        return p ? { maxUploadBytes: p.maxUploadBytes, maxRows: p.maxRows } : null;
      },
      projectLookup: async (pid, uid) => (await prisma.project.findFirst({ where: { id: pid, ownerId: uid } })) !== null,
    });
    const mappingRepository = buildMappingRepository({ prisma, auditRepository });
    const mappingUseCase = buildMappingUseCase({
      repository: mappingRepository,
      prisma,
      pdfTemplateLookup: async (pid, id) => {
        const { data } = await pdfTemplatesRepository.getPdfTemplatesRepository({ filter: { projectId: pid, id } });
        return data ? { placeholders: ['name', 'period', 'net_pay'] } : null;
      },
      engine: {
        extractPlaceholders: () => ['name', 'period', 'net_pay'],
        renderTemplate: (t) => t,
      },
      templateLookup: async (pid, tid) => {
        const { data } = await templatesRepository.getTemplateRepository({ filter: { projectId: pid, id: tid } });
        return data ? { placeholders: ['name', 'period', 'net_pay'] } : null;
      },
      uploadLookup: async (pid, uid) => {
        const { data } = await uploadsRepository.findByIdUploadsRepository({ filter: { projectId: pid, id: uid } });
        return data ? { columns: data.columns } : null;
      },
      projectLookup: async (pid, uid) => (await prisma.project.findFirst({ where: { id: pid, ownerId: uid } })) !== null,
    });
    const pdfTemplatesRepository = buildPdfTemplatesRepository({ prisma, auditRepository });
    const campaignsRepository = buildCampaignsRepository({ prisma, auditRepository });
    const smtpRepository = buildSmtpRepository({ prisma, auditRepository, cryptoService });
    const smtpUseCase = buildSmtpUseCase({
      repository: smtpRepository,
      prisma,
      cryptoService,
      projectLookup: async (pid, uid) => (await prisma.project.findFirst({ where: { id: pid, ownerId: uid } })) !== null,
    });

    demoProjectUseCase = buildDemoProjectUseCase({
      prisma,
      projectsRepository,
      templatesRepository,
      uploadsUseCase,
      mappingUseCase,
      pdfTemplatesRepository,
      campaignsRepository,
      smtpUseCase,
    });

    app = express();
    app.use(express.json());
    app.use(
      createDemoProjectRouter({
        guards: [
          (req, res, next) => {
            req.user = { id: adminId, email: adminEmail, role: 'admin' };
            res.locals.userId = adminId;
            next();
          },
          requireAdmin([adminEmail]),
        ],
        useCase: demoProjectUseCase,
      }),
    );
    app.use(errorHandler);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await pgContainer?.stop();
  });

  it('POST /admin/demo-project seeds project and all resources idempotently', async () => {
    // 1st run: creates
    const res1 = await request(app).post('/admin/demo-project');
    if (res1.status !== 200) {
      console.error('RES1 ERROR:', JSON.stringify(res1.body, null, 2));
    }
    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);
    expect(res1.body.data.created).toBe(true);
    const projectId = res1.body.data.projectId;
    expect(projectId).toBeDefined();

    // Verify all resources in DB
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        emailTemplates: true,
        dataUploads: true,
        pdfTemplates: true,
        campaigns: {
          include: { recipients: true },
        },
      },
    });

    expect(project).toBeDefined();
    expect(project?.name).toBe('Example payroll project');
    expect(project?.emailTemplates.length).toBe(1);
    expect(project?.dataUploads.length).toBe(1);
    expect(project?.pdfTemplates.length).toBe(1);
    expect(project?.campaigns.length).toBe(1);
    expect(project?.campaigns[0].recipients.length).toBe(4);

    // 2nd run: idempotent (returns 200 with created: false)
    const res2 = await request(app).post('/admin/demo-project');
    expect(res2.status).toBe(200);
    expect(res2.body.data.projectId).toBe(projectId);
    expect(res2.body.data.created).toBe(false);
  });


  it('does not create a second instance-wide demo project for another administrator', async () => {
    const otherAdmin = await prisma.user.create({ data: { email: 'second-admin@example.com', name: 'Second Admin', role: 'admin' } });
    const existingProject = await prisma.project.findFirst({ where: { name: 'Example payroll project' } });
    const result = await demoProjectUseCase.seedDemoProjectUseCase({ userId: otherAdmin.id });
    expect(result.data.created).toBe(false);
    expect(result.data.projectId).toBe(existingProject?.id);
    expect(await prisma.project.count({ where: { name: 'Example payroll project' } })).toBe(1);
  });


  it('seeds one complete system-owned workspace once and retains the placeholder SMTP draft', async () => {
    await prisma.project.deleteMany({ where: { name: 'Example payroll project' } });
    const errorReporter: ErrorReporter = { capture: () => undefined };
    await seedSystemDemoProject({ prisma, demoProjectUseCase, errorReporter });
    await seedSystemDemoProject({ prisma, demoProjectUseCase, errorReporter });

    const systemUser = await prisma.user.findUnique({ where: { email: 'demo-owner@system.invalid' } });
    const project = await prisma.project.findFirst({
      where: { name: 'Example payroll project' },
      include: {
        emailTemplates: true,
        pdfTemplates: true,
        dataUploads: { include: { fieldMappings: true } },
        campaigns: true,
        smtpConnections: true,
      },
    });
    expect(systemUser).toMatchObject({ role: 'system', emailVerified: true, disabledReason: 'System account' });
    expect(systemUser?.disabledAt).toBeInstanceOf(Date);
    expect(project?.ownerId).toBe(systemUser?.id);
    expect(await prisma.project.count({ where: { name: 'Example payroll project' } })).toBe(1);
    expect(project?.emailTemplates).toHaveLength(1);
    expect(project?.pdfTemplates).toHaveLength(1);
    expect(project?.dataUploads).toHaveLength(1);
    expect(project?.dataUploads[0].fieldMappings).toHaveLength(1);
    expect(project?.campaigns).toHaveLength(1);
    expect(project?.campaigns[0].status).toBe('draft');
    expect(project?.smtpConnections).toHaveLength(1);
    expect(project?.smtpConnections[0].host).toBe('smtp.example.com');
  });
});
