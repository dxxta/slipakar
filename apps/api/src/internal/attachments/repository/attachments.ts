import type { Attachment, PrismaClient } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';
import type {
  AttachmentRecord,
  AttachmentsRepositoryInterface,
  AttachmentView,
} from '../../../domain/attachments/interface.js';

const select = {
  id: true,
  projectId: true,
  campaignId: true,
  fileName: true,
  sizeBytes: true,
  kind: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function buildAttachmentsRepository({
  prisma,
  auditRepository,
}: {
  prisma: PrismaClient;
  auditRepository: AuditRepositoryInterface;
}): AttachmentsRepositoryInterface {
  const toView = (record: Pick<Attachment, 'id' | 'projectId' | 'campaignId' | 'fileName' | 'sizeBytes' | 'kind' | 'createdAt' | 'updatedAt'>): AttachmentView => ({
    ...record,
    sizeBytes: record.sizeBytes.toString(),
  });

  return {
    async createAttachmentsRepository({ payload, tx, auditUserId }): Promise<{ data: AttachmentView }> {
      const client = tx ?? prisma;
      const record = await client.attachment.create({
        data: payload,
        select,
      });
      await auditRepository.createAuditRepository({
        entity: 'Attachment',
        entityId: record.id,
        action: 'create',
        auditUserId,
        tx,
        changes: [
          { fieldName: 'fileName', fieldValue: record.fileName },
          { fieldName: 'sizeBytes', fieldValue: record.sizeBytes.toString() },
          { fieldName: 'kind', fieldValue: record.kind },
        ],
      });
      return { data: toView(record) };
    },

    async findAllAttachmentsRepository({ filter }): Promise<{ data: AttachmentView[] }> {
      const where: { projectId: string; campaignId?: string } = { projectId: filter.projectId };
      if (filter.campaignId !== undefined) {
        where.campaignId = filter.campaignId;
      }
      const records = await prisma.attachment.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        select,
      });
      return { data: records.map(toView) };
    },

    async findByIdAttachmentsRepository({ filter }): Promise<{ data: AttachmentRecord | null }> {
      const record = await prisma.attachment.findFirst({
        where: { projectId: filter.projectId, id: filter.id },
      });
      return { data: record };
    },

    async deleteAttachmentsRepository({ payload, tx, auditUserId }): Promise<{ data: boolean }> {
      const client = tx ?? prisma;
      const record = await client.attachment.findFirst({
        where: { projectId: payload.projectId, id: payload.id },
        select: { id: true, fileName: true, sizeBytes: true, kind: true },
      });
      if (!record) return { data: false };

      const deleted = await client.attachment.deleteMany({
        where: { projectId: payload.projectId, id: payload.id },
      });

      if (deleted.count > 0) {
        await auditRepository.createAuditRepository({
          entity: 'Attachment',
          entityId: record.id,
          action: 'delete',
          auditUserId,
          tx,
          changes: [
            { fieldName: 'fileName', fieldValue: record.fileName },
            { fieldName: 'sizeBytes', fieldValue: record.sizeBytes.toString() },
            { fieldName: 'kind', fieldValue: record.kind },
          ],
        });
      }
      return { data: deleted.count > 0 };
    },

    async sumSizeAttachmentsRepository({ filter, tx }): Promise<bigint> {
      const client = tx ?? prisma;
      const result = await client.attachment.aggregate({
        where: { projectId: filter.projectId },
        _sum: { sizeBytes: true },
      });
      return result._sum.sizeBytes ?? 0n;
    },
  };
}
