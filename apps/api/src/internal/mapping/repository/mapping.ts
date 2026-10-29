import type { PrismaClient } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';
import type { MappingRepositoryInterface, MappingView } from '../../../domain/mapping/interface.js';

export function buildMappingRepository({ prisma, auditRepository }: { prisma: PrismaClient; auditRepository: AuditRepositoryInterface }): MappingRepositoryInterface {
  const toView = (record: { id: string; templateId: string; uploadId: string; mapping: unknown }): MappingView => ({
    id: record.id, templateId: record.templateId, uploadId: record.uploadId, mapping: record.mapping as Record<string, string>,
  });
  const repository: MappingRepositoryInterface = {
    async upsertMappingRepository({ payload, auditUserId, tx }) {
      const client = tx ?? prisma;
      const existing = await client.fieldMapping.findFirst({ where: { templateId: payload.templateId, uploadId: payload.uploadId } });
      const record = existing
        ? await client.fieldMapping.update({ where: { id: existing.id }, data: { mapping: payload.mapping } })
        : await client.fieldMapping.create({ data: payload });
      await auditRepository.createAuditRepository({
        entity: 'FieldMapping', entityId: record.id, action: existing ? 'update' : 'create',
        changes: [{ fieldName: 'mapping', fieldValue: payload.mapping }], auditUserId, tx,
      });
      return { data: toView(record) };
    },
    async getMappingRepository({ filter }) {
      const record = await prisma.fieldMapping.findFirst({ where: filter });
      return { data: record ? toView(record) : null };
    },
  };
  return repository;
}
