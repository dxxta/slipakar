import type { Prisma, PrismaClient } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';
import type { SmtpRepositoryInterface } from '../../../domain/smtp/interface.js';

export function buildSmtpRepository({ prisma, auditRepository }: {
  prisma: PrismaClient; auditRepository: AuditRepositoryInterface;
}): SmtpRepositoryInterface {
  return {
    async createSmtpRepository({ projectId, payload, auditUserId, tx }) {
      const data = await (tx ?? prisma).smtpConnection.create({ data: { projectId, ...payload } });
      await auditRepository.createAuditRepository({
        entity: 'SmtpConnection', entityId: data.id, action: 'create', auditUserId, tx,
        changes: [
          { fieldName: 'host', fieldValue: data.host }, { fieldName: 'port', fieldValue: data.port },
          { fieldName: 'username', fieldValue: data.username }, { fieldName: 'secure', fieldValue: data.secure },
          ...(data.fromAddress ? [{ fieldName: 'fromAddress', fieldValue: data.fromAddress }] : []),
        ],
      });
      return { data };
    },
    async listSmtpRepository({ filter, page, limit, sortBy, sortDir }) {
      const where: Prisma.SmtpConnectionWhereInput = {
        projectId: filter.projectId,
        ...(filter.q ? {
          OR: [
            { host: { contains: filter.q, mode: 'insensitive' } },
            { username: { contains: filter.q, mode: 'insensitive' } },
            { fromAddress: { contains: filter.q, mode: 'insensitive' } },
          ],
        } : {}),
      };
      const skip = (page - 1) * limit;
      const [total, data] = await Promise.all([
        prisma.smtpConnection.count({ where }),
        prisma.smtpConnection.findMany({
          where,
          orderBy: { [sortBy]: sortDir },
          skip,
          take: limit,
        }),
      ]);
      return {
        data,
        metadata: { page, limit, total },
      };
    },
    async getSmtpRepository({ filter }) {
      return { data: await prisma.smtpConnection.findFirst({ where: { projectId: filter.projectId, id: filter.id } }) };
    },
    async updateSmtpRepository({ filter, payload, auditUserId, tx }) {
      const client = tx ?? prisma;
      const result = await client.smtpConnection.updateMany({ where: filter, data: payload });
      if (!result.count) return { data: null };
      const data = await client.smtpConnection.findFirst({ where: filter });
      await auditRepository.createAuditRepository({
        entity: 'SmtpConnection', entityId: filter.id, action: 'update', auditUserId, tx,
        changes: Object.entries(payload).filter(([name]) => name !== 'passwordEncrypted').map(([fieldName, fieldValue]) => ({ fieldName, fieldValue }))
          .concat(Object.hasOwn(payload, 'passwordEncrypted') ? [{ fieldName: 'credentialsUpdated', fieldValue: true }] : []),
      });
      return { data };
    },
    async deleteSmtpRepository({ filter, auditUserId, tx }) {
      const result = await (tx ?? prisma).smtpConnection.deleteMany({ where: filter });
      if (result.count) await auditRepository.createAuditRepository({
        entity: 'SmtpConnection', entityId: filter.id, action: 'delete', auditUserId, tx,
        changes: [{ fieldName: 'id', fieldValue: filter.id }],
      });
      return { data: result.count > 0 };
    },
  };
}
