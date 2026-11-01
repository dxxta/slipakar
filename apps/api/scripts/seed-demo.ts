import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { buildProjectsRepository } from '../src/internal/projects/repository/projects.js';
import { buildTemplatesRepository } from '../src/internal/templates/repository/templates.js';
import { buildUploadsRepository } from '../src/internal/uploads/repository/uploads.js';
import { buildUploadsUseCase } from '../src/internal/uploads/usecase/uploads.js';
import { buildMappingRepository } from '../src/internal/mapping/repository/mapping.js';
import { buildMappingUseCase } from '../src/internal/mapping/usecase/mapping.js';
import { buildPdfTemplatesRepository } from '../src/internal/pdf-templates/repository/pdf-templates.js';
import { buildCampaignsRepository } from '../src/internal/campaigns/repository/campaigns.js';
import { buildSmtpRepository } from '../src/internal/smtp/repository/smtp.js';
import { buildSmtpUseCase } from '../src/internal/smtp/usecase/smtp.js';
import { buildAuditRepository } from '../src/internal/audit/repository/audit.js';
import { fileParser } from '../src/internal/uploads/parser/file-parser.js';
import { createCryptoService } from '../src/services/crypto.js';
import { extractPlaceholders, renderTemplate } from '../src/internal/templates/renderer/template-renderer.js';
import { extractPdfPlaceholders } from '../src/internal/pdf-templates/placeholders.js';
import { buildDemoProjectUseCase } from '../src/internal/demo-project/usecase/demo-project.js';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const appEncryptionKey = process.env.APP_ENCRYPTION_KEY || 'a'.repeat(64);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  try {
    // Find an admin user to own the demo project
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    let adminUser = await prisma.user.findFirst({
      where: {
        OR: [
          { role: 'admin' },
          ...(adminEmails.length > 0 ? [{ email: { in: adminEmails, mode: 'insensitive' as const } }] : []),
        ],
      },
    });

    if (!adminUser) {
      // Find any user or create a fallback admin user
      adminUser = await prisma.user.findFirst();
      if (!adminUser) {
        adminUser = await prisma.user.create({
          data: {
            email: adminEmails[0] || 'admin@example.com',
            name: 'Administrator',
            role: 'admin',
            emailVerified: true,
          },
        });
      }
    }

    const auditRepository = buildAuditRepository(prisma);
    const cryptoService = createCryptoService(appEncryptionKey);
    const projectsRepository = buildProjectsRepository({ prisma, auditRepository });
    const templatesRepository = buildTemplatesRepository({ prisma, auditRepository });
    const uploadsRepository = buildUploadsRepository({ prisma, auditRepository });

    const ownsProject = async (projectId: string, userId: string) => {
      const p = await prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
      return p !== null;
    };

    const uploadsUseCase = buildUploadsUseCase({
      repository: uploadsRepository,
      prisma,
      parser: fileParser,
      settingsLookup: async (projectId, userId) => {
        const p = await prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
        return p ? { maxUploadBytes: p.maxUploadBytes, maxRows: p.maxRows } : null;
      },
      projectLookup: ownsProject,
    });

    const pdfTemplatesRepository = buildPdfTemplatesRepository({ prisma, auditRepository });
    const pdfTemplateLookup = async (projectId: string, id: string) => {
      const { data } = await pdfTemplatesRepository.getPdfTemplatesRepository({
        filter: { projectId, id },
      });
      return data ? { placeholders: extractPdfPlaceholders(data.nodeTree) } : null;
    };

    const mappingRepository = buildMappingRepository({ prisma, auditRepository });
    const mappingUseCase = buildMappingUseCase({
      repository: mappingRepository,
      prisma,
      pdfTemplateLookup,
      engine: { extractPlaceholders, renderTemplate },
      templateLookup: async (projectId, templateId) => {
        const { data } = await templatesRepository.getTemplateRepository({
          filter: { projectId, id: templateId },
        });
        return data ? { placeholders: extractPlaceholders(data.bodyHtml) } : null;
      },
      uploadLookup: async (projectId, uploadId) => {
        const { data } = await uploadsRepository.findByIdUploadsRepository({
          filter: { projectId, id: uploadId },
        });
        return data ? { columns: data.columns } : null;
      },
      projectLookup: ownsProject,
    });

    const campaignsRepository = buildCampaignsRepository({ prisma, auditRepository });
    const smtpRepository = buildSmtpRepository({ prisma, auditRepository, cryptoService });
    const smtpUseCase = buildSmtpUseCase({
      repository: smtpRepository,
      prisma,
      cryptoService,
      projectLookup: ownsProject,
    });

    const demoUseCase = buildDemoProjectUseCase({
      prisma,
      projectsRepository,
      templatesRepository,
      uploadsUseCase,
      mappingUseCase,
      pdfTemplatesRepository,
      campaignsRepository,
      smtpUseCase,
    });

    const result = await demoUseCase.seedDemoProjectUseCase({ userId: adminUser.id });
    console.log(
      result.data.created
        ? `Demo project created successfully with ID: ${result.data.projectId}`
        : `Demo project already exists with ID: ${result.data.projectId}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Failed to seed demo project:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
