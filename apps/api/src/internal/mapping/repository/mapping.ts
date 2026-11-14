import type { PrismaClient } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';
import type { MappingRepositoryInterface, MappingView } from '../../../domain/mapping/interface.js';
import type { DataVaultInterface } from '../../../services/data-vault.js';

export function buildMappingRepository({ prisma, auditRepository, dataVault, projectIdOfTemplate }: {
  prisma: PrismaClient;
  auditRepository: AuditRepositoryInterface;
  dataVault: DataVaultInterface;
  projectIdOfTemplate: (templateId: string) => Promise<string>;
}): MappingRepositoryInterface {
  // The mapping is stored encrypted with the owner's data key.
  const toView = async (record: { id: string; templateId: string; uploadId: string; mapping: unknown }): Promise<MappingView> => {
    const vault = await dataVault.forProject(await projectIdOfTemplate(record.templateId));
    return { id: record.id, templateId: record.templateId, uploadId: record.uploadId, mapping: vault.decryptJson<Record<string, string>>(record.mapping) };
  };
  const repository: MappingRepositoryInterface = {
    async upsertMappingRepository({ payload, auditUserId, tx }) {
      const client = tx ?? prisma;
      const existing = await client.fieldMapping.findFirst({ where: { templateId: payload.templateId, uploadId: payload.uploadId } });
      const vault = await dataVault.forProject(await projectIdOfTemplate(payload.templateId));
      const encrypted = vault.encryptJson(payload.mapping);
      const record = existing
        ? await client.fieldMapping.update({ where: { id: existing.id }, data: { mapping: encrypted } })
        : await client.fieldMapping.create({ data: { ...payload, mapping: encrypted } });
      await auditRepository.createAuditRepository({
        entity: 'FieldMapping', entityId: record.id, action: existing ? 'update' : 'create',
        changes: [{ fieldName: 'placeholderCount', fieldValue: Object.keys(payload.mapping).length }], auditUserId, tx,
      });
      return { data: await toView(record) };
    },
    async getMappingRepository({ filter }) {
      const record = await prisma.fieldMapping.findFirst({ where: filter });
      return { data: record ? await toView(record) : null };
    },
  };
  return repository;
}
