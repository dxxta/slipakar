import type { Prisma, PrismaClient } from '@prisma/client';
import type { AuditChange, AuditRepositoryInterface } from '../../../domain/audit/interface.js';
import type { TemplatesRepositoryInterface } from '../../../domain/templates/interface.js';

export function buildTemplatesRepository({ prisma, auditRepository }: {
  prisma: PrismaClient; auditRepository: AuditRepositoryInterface;
}): TemplatesRepositoryInterface {
  return {
    async createTemplateRepository({ projectId, payload, auditUserId, tx }) {
      const data = await (tx ?? prisma).emailTemplate.create({ data: { projectId, ...payload } });
      await auditRepository.createAuditRepository({
        entity: 'EmailTemplate', entityId: data.id, action: 'create', auditUserId, tx,
        changes: [{ fieldName: 'name', fieldValue: data.name }, { fieldName: 'subject', fieldValue: data.subject }],
      });
      return { data };
    },
    async listTemplateRepository({ filter, page, limit, sortBy, sortDir }) {
      const where: Prisma.EmailTemplateWhereInput = {
        projectId: filter.projectId,
        ...(filter.q ? { name: { contains: filter.q, mode: 'insensitive' } } : {}),
      };
      const skip = (page - 1) * limit;
      const [total, data] = await Promise.all([
        prisma.emailTemplate.count({ where }),
        prisma.emailTemplate.findMany({
          where,
          orderBy: { [sortBy]: sortDir },
          skip,
          take: limit,
        }),
      ]);
      return {
        data,
        metadata: { page, limit, total },
      };
    },
    async getTemplateRepository({ filter }) {
      return { data: await prisma.emailTemplate.findFirst({ where: filter }) };
    },
    async updateTemplateRepository({ filter, payload, auditUserId, tx }) {
      const client = tx ?? prisma;
      const result = await client.emailTemplate.updateMany({ where: filter, data: payload });
      if (!result.count) return { data: null };
      const data = await client.emailTemplate.findFirst({ where: filter });
      const changes: AuditChange[] = Object.entries(payload).filter(([name]) => name !== 'bodyHtml').map(([fieldName, fieldValue]) => ({ fieldName, fieldValue }));
      if (Object.hasOwn(payload, 'bodyHtml')) changes.push({ fieldName: 'bodyHtmlUpdated', fieldValue: true });
      await auditRepository.createAuditRepository({
        entity: 'EmailTemplate', entityId: filter.id, action: 'update', auditUserId, tx,
        changes,
      });
      return { data };
    },
    async deleteTemplateRepository({ filter, auditUserId, tx }) {
      const result = await (tx ?? prisma).emailTemplate.deleteMany({ where: filter });
      if (result.count) await auditRepository.createAuditRepository({
        entity: 'EmailTemplate', entityId: filter.id, action: 'delete', auditUserId, tx,
        changes: [{ fieldName: 'id', fieldValue: filter.id }],
      });
      return { data: result.count > 0 };
    },
  };
}
