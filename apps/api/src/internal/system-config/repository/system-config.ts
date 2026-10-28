import type { PrismaClient } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';
import type { SystemConfigRepositoryInterface } from '../../../domain/system-config/interface.js';

export function buildSystemConfigRepository({ prisma, auditRepository }: {
  prisma: PrismaClient;
  auditRepository: AuditRepositoryInterface;
}): SystemConfigRepositoryInterface {
  return {
    async listSystemConfigRepository() {
      const data = await prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
      return { data };
    },
    async getSystemConfigRepository({ filter }) {
      const data = await prisma.systemConfig.findUnique({ where: { key: filter.key } });
      return { data };
    },
    async upsertSystemConfigRepository({ payload, auditUserId, tx }) {
      const client = tx ?? prisma;
      const data = await client.systemConfig.upsert({
        where: { key: payload.key },
        update: { value: payload.value },
        create: { key: payload.key, value: payload.value },
      });
      await auditRepository.createAuditRepository({
        entity: 'SystemConfig',
        entityId: data.id,
        action: 'update',
        auditUserId,
        tx,
        changes: [{ fieldName: 'value', fieldValue: payload.value }],
      });
      return { data };
    },
  };
}
