import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../domain/audit/interface.js';
import type {
  AttachmentRecord,
  AttachmentsRepositoryInterface,
  AttachmentView,
} from '../../domain/attachments/interface.js';
import type { StorageInterface } from '../../domain/storage/interface.js';
import { AppError } from '../../lib/app-error.js';
import { inTransaction } from '../../lib/in-transaction.js';

export function sanitizeFileName(fileName: string): string {
  const baseName = fileName.split(/[/\\]/).pop() ?? '';
  const sanitized = baseName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const trimmed = sanitized.length === 0 ? 'file' : sanitized;
  return trimmed.slice(0, 100);
}

export function toAttachmentView(record: {
  id: string;
  projectId: string;
  campaignId: string | null;
  fileName: string;
  sizeBytes: string | bigint;
  kind: string;
  createdAt: Date;
  updatedAt: Date;
}): AttachmentView {
  const { id, projectId, campaignId, fileName, sizeBytes, kind, createdAt, updatedAt } = record;
  return {
    id,
    projectId,
    campaignId,
    fileName,
    sizeBytes: typeof sizeBytes === 'bigint' ? sizeBytes.toString() : sizeBytes,
    kind,
    createdAt,
    updatedAt,
  };
}

export interface AttachmentStoreInterface {
  storeAttachment(args: {
    projectId: string;
    campaignId?: string | null;
    fileName: string;
    buffer: Buffer;
    contentType: string;
    kind: string;
    auditUserId: string;
    objectKeyOverride?: string;
    quotaBytes?: bigint;
  }): Promise<AttachmentView>;

  removeAttachment(args: {
    id: string;
    projectId: string;
    auditUserId: string;
  }): Promise<void>;
}

export function buildAttachmentStore({
  prisma,
  storage,
  auditRepository,
  repository,
}: {
  prisma: PrismaClient;
  storage: StorageInterface;
  auditRepository: AuditRepositoryInterface;
  repository?: AttachmentsRepositoryInterface;
}): AttachmentStoreInterface {
  return {
    async storeAttachment({
      projectId,
      campaignId,
      fileName,
      buffer,
      contentType,
      kind,
      auditUserId,
      objectKeyOverride,
      quotaBytes,
    }): Promise<AttachmentView> {
      const sanitizedName = sanitizeFileName(fileName);
      const objectKey = objectKeyOverride ?? `${projectId}/${randomUUID()}/${sanitizedName}`;
      const fileSize = BigInt(buffer.length);

      // Lock project row FOR UPDATE, check quota, insert attachment row
      const createdRecord = await inTransaction(prisma, async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${projectId} FOR UPDATE`;

        let effectiveQuota = quotaBytes;
        if (effectiveQuota === undefined) {
          const projects = await tx.$queryRaw<{ id: string; storageQuotaBytes: bigint }[]>`
            SELECT id, "storageQuotaBytes" FROM "Project" WHERE id = ${projectId}
          `;
          if (projects.length === 0) {
            throw new AppError(404, 'NOT_FOUND', 'Project not found');
          }
          effectiveQuota = projects[0].storageQuotaBytes;
        }

        const used = repository
          ? await repository.sumSizeAttachmentsRepository({ filter: { projectId }, tx })
          : (
              await tx.attachment.aggregate({
                where: { projectId },
                _sum: { sizeBytes: true },
              })
            )._sum.sizeBytes ?? 0n;

        if (used + fileSize > effectiveQuota) {
          throw new AppError(413, 'STORAGE_QUOTA_EXCEEDED', 'Storage quota exceeded');
        }

        if (repository) {
          const { data } = await repository.createAttachmentsRepository({
            payload: {
              projectId,
              campaignId: campaignId ?? null,
              objectKey,
              fileName: sanitizedName,
              sizeBytes: fileSize,
              kind,
            },
            auditUserId,
            tx,
          });
          return data;
        }

        const record = await tx.attachment.create({
          data: {
            projectId,
            campaignId: campaignId ?? null,
            objectKey,
            fileName: sanitizedName,
            sizeBytes: fileSize,
            kind,
          },
          select: {
            id: true,
            projectId: true,
            campaignId: true,
            fileName: true,
            sizeBytes: true,
            kind: true,
            createdAt: true,
            updatedAt: true,
          },
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

        return record;
      });

      // Put to storage after transaction commits. Compensate on error.
      try {
        await storage.putObject({
          key: objectKey,
          body: buffer,
          contentType,
        });
      } catch (storageError) {
        await inTransaction(prisma, async (tx) => {
          if (repository) {
            await repository.deleteAttachmentsRepository({
              payload: { projectId, id: createdRecord.id },
              auditUserId,
              tx,
            });
          } else {
            const deleted = await tx.attachment.deleteMany({
              where: { projectId, id: createdRecord.id },
            });
            if (deleted.count > 0) {
              await auditRepository.createAuditRepository({
                entity: 'Attachment',
                entityId: createdRecord.id,
                action: 'delete',
                auditUserId,
                tx,
                changes: [
                  { fieldName: 'fileName', fieldValue: createdRecord.fileName },
                  { fieldName: 'sizeBytes', fieldValue: createdRecord.sizeBytes.toString() },
                  { fieldName: 'kind', fieldValue: createdRecord.kind },
                ],
              });
            }
          }
        });
        throw storageError;
      }

      return toAttachmentView(createdRecord);
    },

    async removeAttachment({ id, projectId, auditUserId }): Promise<void> {
      let objectKeyToDelete: string | null = null;

      if (repository) {
        const { data: record } = await repository.findByIdAttachmentsRepository({
          filter: { projectId, id },
        });
        if (!record) {
          throw new AppError(404, 'NOT_FOUND', 'Attachment not found');
        }
        objectKeyToDelete = (record as AttachmentRecord).objectKey;

        await inTransaction(prisma, async (tx) => {
          const { data: deleted } = await repository.deleteAttachmentsRepository({
            payload: { projectId, id },
            auditUserId,
            tx,
          });
          if (!deleted) {
            throw new AppError(404, 'NOT_FOUND', 'Attachment not found');
          }
        });
      } else {
        await inTransaction(prisma, async (tx) => {
          const record = await tx.attachment.findFirst({
            where: { projectId, id },
          });
          if (!record) {
            throw new AppError(404, 'NOT_FOUND', 'Attachment not found');
          }
          objectKeyToDelete = record.objectKey;

          const deleted = await tx.attachment.deleteMany({
            where: { projectId, id },
          });
          if (deleted.count > 0) {
            await auditRepository.createAuditRepository({
              entity: 'Attachment',
              entityId: id,
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
        });
      }

      if (objectKeyToDelete) {
        await storage.deleteObject(objectKeyToDelete);
      }
    },
  };
}
