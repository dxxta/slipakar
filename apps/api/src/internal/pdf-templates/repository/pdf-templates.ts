import type { PdfTemplate, Prisma, PrismaClient } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';
import type {
  PdfNodeTree,
  PdfTemplatesRepositoryInterface,
  PdfTemplateView,
} from '../../../domain/pdf-templates/interface.js';

export function buildPdfTemplatesRepository({
  prisma,
  auditRepository,
}: {
  prisma: PrismaClient;
  auditRepository: AuditRepositoryInterface;
}): PdfTemplatesRepositoryInterface {
  const toView = (record: PdfTemplate): PdfTemplateView => ({
    ...record,
    nodeTree: record.nodeTree as unknown as PdfNodeTree,
  });

  return {
    async createPdfTemplatesRepository({ projectId, payload, auditUserId, tx }): Promise<{ data: PdfTemplateView }> {
      const client = tx ?? prisma;
      const record = await client.pdfTemplate.create({
        data: {
          projectId,
          name: payload.name,
          nodeTree: payload.nodeTree as unknown as Prisma.InputJsonValue,
        },
      });

      await auditRepository.createAuditRepository({
        entity: 'PdfTemplate',
        entityId: record.id,
        action: 'create',
        auditUserId,
        tx,
        changes: [{ fieldName: 'name', fieldValue: record.name }],
      });

      return { data: toView(record) };
    },

    async listPdfTemplatesRepository({ filter, page, limit, sortBy, sortDir }): Promise<{ data: PdfTemplateView[]; metadata?: { page: number; limit: number; total: number } }> {
      const where: Prisma.PdfTemplateWhereInput = {
        projectId: filter.projectId,
        ...(filter.q ? { name: { contains: filter.q, mode: 'insensitive' } } : {}),
      };
      const skip = (page - 1) * limit;
      const [total, records] = await Promise.all([
        prisma.pdfTemplate.count({ where }),
        prisma.pdfTemplate.findMany({
          where,
          orderBy: { [sortBy]: sortDir },
          skip,
          take: limit,
        }),
      ]);
      return {
        data: records.map(toView),
        metadata: { page, limit, total },
      };
    },

    async getPdfTemplatesRepository({ filter }): Promise<{ data: PdfTemplateView | null }> {
      const record = await prisma.pdfTemplate.findFirst({
        where: { projectId: filter.projectId, id: filter.id },
      });
      return { data: record ? toView(record) : null };
    },

    async updatePdfTemplatesRepository({ filter, payload, auditUserId, tx }): Promise<{ data: PdfTemplateView | null }> {
      const client = tx ?? prisma;
      const updateData: Prisma.PdfTemplateUpdateInput = {};
      if (payload.name !== undefined) updateData.name = payload.name;
      if (payload.nodeTree !== undefined) {
        updateData.nodeTree = payload.nodeTree as unknown as Prisma.InputJsonValue;
      }

      const res = await client.pdfTemplate.updateMany({
        where: { projectId: filter.projectId, id: filter.id },
        data: updateData,
      });

      if (res.count === 0) return { data: null };

      const updated = await client.pdfTemplate.findFirst({
        where: { projectId: filter.projectId, id: filter.id },
      });
      if (!updated) return { data: null };

      const changes = [];
      if (payload.name !== undefined) changes.push({ fieldName: 'name', fieldValue: payload.name });
      if (payload.nodeTree !== undefined) changes.push({ fieldName: 'nodeTree', fieldValue: '[updated]' });

      await auditRepository.createAuditRepository({
        entity: 'PdfTemplate',
        entityId: filter.id,
        action: 'update',
        auditUserId,
        tx,
        changes,
      });

      return { data: toView(updated) };
    },

    async deletePdfTemplatesRepository({ filter, auditUserId, tx }): Promise<{ data: boolean }> {
      const client = tx ?? prisma;
      const existing = await client.pdfTemplate.findFirst({
        where: { projectId: filter.projectId, id: filter.id },
      });
      if (!existing) return { data: false };

      const deleted = await client.pdfTemplate.deleteMany({
        where: { projectId: filter.projectId, id: filter.id },
      });

      if (deleted.count > 0) {
        await auditRepository.createAuditRepository({
          entity: 'PdfTemplate',
          entityId: filter.id,
          action: 'delete',
          auditUserId,
          tx,
          changes: [{ fieldName: 'name', fieldValue: existing.name }],
        });
      }

      return { data: deleted.count > 0 };
    },

    async countCampaignsUsingTemplateRepository({ pdfTemplateId, tx }): Promise<number> {
      const client = tx ?? prisma;
      return client.campaign.count({
        where: { pdfTemplateId },
      });
    },
  };
}
