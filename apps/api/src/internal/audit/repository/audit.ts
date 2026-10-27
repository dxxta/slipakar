import { Prisma, type PrismaClient } from '@prisma/client';
import type { AuditRecord, AuditRepositoryInterface } from '../../../domain/audit/interface.js';

const sensitiveFields = new Set(['password', 'passwordencrypted', 'secret', 'accesskey', 'secretkey']);

export function buildAuditRepository(prisma: PrismaClient): AuditRepositoryInterface {
  const repository: AuditRepositoryInterface = {
    async createAuditRepository(payload): Promise<{ data: { count: number } }> {
      const changes = payload.changes.filter((change) => !sensitiveFields.has(change.fieldName.toLowerCase()));
      if (changes.length === 0) return { data: { count: 0 } };
      const client = payload.tx ?? prisma;
      const result = await client.auditLog.createMany({
        data: changes.map((change) => ({
          entity: payload.entity,
          entityId: payload.entityId,
          action: payload.action,
          fieldName: change.fieldName,
          fieldValue: change.fieldValue === undefined
            ? Prisma.DbNull
            : change.fieldValue === null
              ? Prisma.JsonNull
              : change.fieldValue as Prisma.InputJsonValue,
          userId: payload.auditUserId,
        })),
      });
      return { data: { count: result.count } };
    },

    async findActivityByProjectRepository({ projectId, page, limit }) {
      // 1. Gather all entity IDs associated with this project:
      const [
        smtpRows,
        emailTemplateRows,
        pdfTemplateRows,
        uploadRows,
        campaignRows,
        attachmentRows,
        notificationRows,
      ] = await Promise.all([
        prisma.smtpConnection.findMany({ where: { projectId }, select: { id: true } }),
        prisma.emailTemplate.findMany({ where: { projectId }, select: { id: true } }),
        prisma.pdfTemplate.findMany({ where: { projectId }, select: { id: true } }),
        prisma.dataUpload.findMany({ where: { projectId }, select: { id: true } }),
        prisma.campaign.findMany({ where: { projectId }, select: { id: true } }),
        prisma.attachment.findMany({ where: { projectId }, select: { id: true } }),
        prisma.notification.findMany({ where: { projectId }, select: { id: true } }),
      ]);

      const campaignIds = campaignRows.map((r) => r.id);
      const [fieldMappingRows, recipientRows] = await Promise.all([
        prisma.fieldMapping.findMany({
          where: { uploadId: { in: uploadRows.map((r) => r.id) } },
          select: { id: true },
        }),
        campaignIds.length > 0
          ? prisma.campaignRecipient.findMany({
              where: { campaignId: { in: campaignIds } },
              select: { id: true },
            })
          : Promise.resolve([]),
      ]);

      const entityFilters: Array<{ entity: string; entityId: string | { in: string[] } }> = [
        { entity: 'Project', entityId: projectId },
      ];

      if (smtpRows.length > 0) {
        entityFilters.push({ entity: 'SmtpConnection', entityId: { in: smtpRows.map((r) => r.id) } });
      }
      if (emailTemplateRows.length > 0) {
        entityFilters.push({ entity: 'EmailTemplate', entityId: { in: emailTemplateRows.map((r) => r.id) } });
      }
      if (pdfTemplateRows.length > 0) {
        entityFilters.push({ entity: 'PdfTemplate', entityId: { in: pdfTemplateRows.map((r) => r.id) } });
      }
      if (uploadRows.length > 0) {
        entityFilters.push({ entity: 'DataUpload', entityId: { in: uploadRows.map((r) => r.id) } });
      }
      if (fieldMappingRows.length > 0) {
        entityFilters.push({ entity: 'FieldMapping', entityId: { in: fieldMappingRows.map((r) => r.id) } });
      }
      if (campaignRows.length > 0) {
        entityFilters.push({ entity: 'Campaign', entityId: { in: campaignIds } });
      }
      if (recipientRows.length > 0) {
        entityFilters.push({ entity: 'CampaignRecipient', entityId: { in: recipientRows.map((r) => r.id) } });
      }
      if (attachmentRows.length > 0) {
        entityFilters.push({ entity: 'Attachment', entityId: { in: attachmentRows.map((r) => r.id) } });
      }
      if (notificationRows.length > 0) {
        entityFilters.push({ entity: 'Notification', entityId: { in: notificationRows.map((r) => r.id) } });
      }

      const whereClause: Prisma.AuditLogWhereInput = {
        OR: entityFilters,
        NOT: {
          fieldName: {
            in: Array.from(sensitiveFields),
            mode: 'insensitive',
          },
        },
      };

      const skip = (page - 1) * limit;

      const [total, rows] = await Promise.all([
        prisma.auditLog.count({ where: whereClause }),
        prisma.auditLog.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
      ]);

      const data: AuditRecord[] = rows.map((row) => ({
        id: row.id,
        entity: row.entity,
        entityId: row.entityId,
        action: row.action,
        fieldName: row.fieldName,
        fieldValue: row.fieldValue,
        userId: row.userId,
        createdAt: row.createdAt,
      }));

      return {
        data,
        metadata: { page, limit, total },
      };
    },
  };
  return repository;
}
