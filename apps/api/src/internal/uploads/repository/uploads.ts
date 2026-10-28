import type { PrismaClient } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';
import type { UploadsRepositoryInterface, UploadView } from '../../../domain/uploads/interface.js';

const select = { id: true, projectId: true, fileName: true, columns: true, rowCount: true, createdAt: true, updatedAt: true } as const;

export function buildUploadsRepository({ prisma, auditRepository }: {
  prisma: PrismaClient;
  auditRepository: AuditRepositoryInterface;
}): UploadsRepositoryInterface {
  const toUpload = (record: Omit<UploadView, 'columns'> & { columns: unknown }): UploadView => ({
    ...record, columns: record.columns as string[],
  });
  return {
    async createUploadsRepository({ payload, tx, auditUserId }): Promise<{ data: UploadView }> {
      const client = tx ?? prisma;
      const record = await client.dataUpload.create({
        data: { projectId: payload.projectId, fileName: payload.fileName, columns: payload.columns, rows: payload.rows, rowCount: payload.rows.length },
        select,
      });
      await auditRepository.createAuditRepository({
        entity: 'DataUpload', entityId: record.id, action: 'create', auditUserId, tx,
        changes: [{ fieldName: 'fileName', fieldValue: record.fileName }, { fieldName: 'rowCount', fieldValue: record.rowCount }],
      });
      return { data: toUpload(record) };
    },
    async findAllUploadsRepository({ filter }): Promise<{ data: UploadView[] }> {
      const records = await prisma.dataUpload.findMany({ where: { projectId: filter.projectId }, orderBy: { createdAt: 'asc' }, select });
      return { data: records.map(toUpload) };
    },
    async findByIdUploadsRepository({ filter }): Promise<{ data: UploadView | null }> {
      const record = await prisma.dataUpload.findFirst({ where: { projectId: filter.projectId, id: filter.id }, select });
      return { data: record ? toUpload(record) : null };
    },
    async getRowsUploadsRepository({ filter }): Promise<{ data: Record<string, string>[] | null }> {
      const record = await prisma.dataUpload.findFirst({ where: { projectId: filter.projectId, id: filter.id }, select: { rows: true } });
      return { data: record ? record.rows as Record<string, string>[] : null };
    },
    async deleteUploadsRepository({ payload, tx, auditUserId }): Promise<{ data: boolean }> {
      const client = tx ?? prisma;
      const record = await client.dataUpload.findFirst({ where: { projectId: payload.projectId, id: payload.id }, select: { id: true, fileName: true, rowCount: true } });
      if (!record) return { data: false };
      const deleted = await client.dataUpload.deleteMany({ where: { projectId: payload.projectId, id: payload.id } });
      if (deleted.count > 0) {
        await auditRepository.createAuditRepository({
          entity: 'DataUpload', entityId: record.id, action: 'delete', auditUserId, tx,
          changes: [{ fieldName: 'fileName', fieldValue: record.fileName }, { fieldName: 'rowCount', fieldValue: record.rowCount }],
        });
      }
      return { data: deleted.count > 0 };
    },
  };
}
