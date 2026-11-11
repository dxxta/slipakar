import { Prisma, type ApiKey, type PrismaClient } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';
import type { ApiKeysRepositoryInterface, ApiKeyView } from '../../../domain/apikeys/interface.js';

const safeView = (key: ApiKey): ApiKeyView => ({ id: key.id, projectId: key.projectId, name: key.name, prefix: key.prefix, scopes: key.scopes, expiresAt: key.expiresAt, revokedAt: key.revokedAt, lastUsedAt: key.lastUsedAt, createdAt: key.createdAt });

export function buildApiKeysRepository({ prisma, auditRepository }: { prisma: PrismaClient; auditRepository: AuditRepositoryInterface }): ApiKeysRepositoryInterface {
  return {
    async listApiKeys(projectId) {
      const rows = await prisma.apiKey.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
      return rows.map(safeView);
    },
    countActiveApiKeys(projectId, now) {
      return prisma.apiKey.count({ where: { projectId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } });
    },
    findByPrefix(prefix) {
      return prisma.apiKey.findFirst({ where: { prefix }, include: { project: { include: { owner: { select: { id: true, email: true, role: true, disabledAt: true, disabledReason: true } } } } } }) as ReturnType<ApiKeysRepositoryInterface['findByPrefix']>;
    },
    async createApiKey({ data, auditUserId, tx }) {
      const client = tx ?? prisma;
      const created = await client.apiKey.create({ data });
      await auditRepository.createAuditRepository({ entity: 'ApiKey', entityId: created.id, action: 'create', auditUserId, tx, changes: [{ fieldName: 'name', fieldValue: created.name }, { fieldName: 'projectId', fieldValue: created.projectId }, { fieldName: 'scopes', fieldValue: created.scopes }] });
      return safeView(created);
    },
    async revokeApiKey({ id, projectId, auditUserId, tx }) {
      const client = tx ?? prisma;
      const existing = await client.apiKey.findFirst({ where: { id, projectId } });
      if (!existing) return null;
      if (!existing.revokedAt) {
        const updated = await client.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
        await auditRepository.createAuditRepository({ entity: 'ApiKey', entityId: id, action: 'update', auditUserId, tx, changes: [{ fieldName: 'revokedAt', fieldValue: updated.revokedAt?.toISOString() }] });
        return safeView(updated);
      }
      return safeView(existing);
    },
    async touchApiKey(id, now) {
      await prisma.apiKey.updateMany({ where: { id, OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: new Date(now.getTime() - 60_000) } }] }, data: { lastUsedAt: now } });
    },
  };
}
