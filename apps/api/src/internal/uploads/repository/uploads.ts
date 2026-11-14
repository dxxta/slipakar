import type { PrismaClient } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';
import type { UploadsRepositoryInterface, UploadView } from '../../../domain/uploads/interface.js';
import type { DataVaultInterface } from '../../../services/data-vault.js';

const select = { id: true, projectId: true, fileName: true, columns: true, rowCount: true, createdAt: true, updatedAt: true } as const;

export function buildUploadsRepository({ prisma, auditRepository, dataVault }: {
  prisma: PrismaClient;
  auditRepository: AuditRepositoryInterface;
  dataVault: DataVaultInterface;
}): UploadsRepositoryInterface {
  // fileName, columns and rows are stored encrypted with the owner's data key.
  const toUpload = async (record: Omit<UploadView, 'columns'> & { columns: unknown }): Promise<UploadView> => {
    const vault = await dataVault.forProject(record.projectId);
    return { ...record, fileName: vault.decryptText(record.fileName), columns: vault.decryptJson<string[]>(record.columns) };
  };
  return {
    async createUploadsRepository({ payload, tx, auditUserId }): Promise<{ data: UploadView }> {
      const client = tx ?? prisma;
      const vault = await dataVault.forProject(payload.projectId);
      const record = await client.dataUpload.create({
        data: {
          projectId: payload.projectId,
          fileName: vault.encryptText(payload.fileName),
          columns: vault.encryptJson(payload.columns),
          rows: vault.encryptJson(payload.rows),
          rowCount: payload.rows.length,
        },
        select,
      });
      await auditRepository.createAuditRepository({
        entity: 'DataUpload', entityId: record.id, action: 'create', auditUserId, tx,
        changes: [{ fieldName: 'rowCount', fieldValue: record.rowCount }],
      });
      return { data: await toUpload(record) };
    },
    async findAllUploadsRepository({ filter }): Promise<{ data: UploadView[] }> {
      const records = await prisma.dataUpload.findMany({ where: { projectId: filter.projectId }, orderBy: { createdAt: 'asc' }, select });
      return { data: await Promise.all(records.map(toUpload)) };
    },
    async findByIdUploadsRepository({ filter }): Promise<{ data: UploadView | null }> {
      const record = await prisma.dataUpload.findFirst({ where: { projectId: filter.projectId, id: filter.id }, select });
      return { data: record ? await toUpload(record) : null };
    },
    async getRowsUploadsRepository({ filter }): Promise<{ data: Record<string, string>[] | null }> {
      const record = await prisma.dataUpload.findFirst({ where: { projectId: filter.projectId, id: filter.id }, select: { rows: true } });
      if (!record) return { data: null };
      return { data: (await dataVault.forProject(filter.projectId)).decryptJson<Record<string, string>[]>(record.rows) };
    },
    async deleteUploadsRepository({ payload, tx, auditUserId }): Promise<{ data: boolean }> {
      const client = tx ?? prisma;
      const record = await client.dataUpload.findFirst({ where: { projectId: payload.projectId, id: payload.id }, select: { id: true, rowCount: true } });
      if (!record) return { data: false };
      const deleted = await client.dataUpload.deleteMany({ where: { projectId: payload.projectId, id: payload.id } });
      if (deleted.count > 0) {
        await auditRepository.createAuditRepository({
          entity: 'DataUpload', entityId: record.id, action: 'delete', auditUserId, tx,
          changes: [{ fieldName: 'rowCount', fieldValue: record.rowCount }],
        });
      }
      return { data: deleted.count > 0 };
    },
  };
}
