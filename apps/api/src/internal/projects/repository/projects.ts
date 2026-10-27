import type { Prisma, PrismaClient } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';
import type { ProjectsRepositoryInterface } from '../../../domain/projects/interface.js';

export function buildProjectsRepository({ prisma, auditRepository }: { prisma: PrismaClient; auditRepository: AuditRepositoryInterface }): ProjectsRepositoryInterface {
  const repository: ProjectsRepositoryInterface = {
    async createProjectRepository({ payload, auditUserId, tx }) {
      const client = tx ?? prisma;
      const project = await client.project.create({ data: { ownerId: payload.ownerId, name: payload.name } });
      await auditRepository.createAuditRepository({ entity: 'Project', entityId: project.id, action: 'create', changes: [{ fieldName: 'name', fieldValue: project.name }], auditUserId, tx });
      return { data: project };
    },
    async getProjectsRepository({ filter, page, limit, sortBy, sortDir }) {
      const where: Prisma.ProjectWhereInput = {
        ownerId: filter.ownerId,
        ...(filter.q ? { name: { contains: filter.q, mode: 'insensitive' } } : {}),
      };
      const skip = (page - 1) * limit;
      const [total, data] = await Promise.all([
        prisma.project.count({ where }),
        prisma.project.findMany({
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
    async getSingleProjectRepository({ filter }) {
      return { data: await prisma.project.findFirst({ where: filter }) };
    },
    async updateProjectRepository({ payload, auditUserId, tx }) {
      const client = tx ?? prisma;
      const { id, ownerId, storageQuotaBytes, ...fields } = payload;
      const data = { ...fields, ...(storageQuotaBytes === undefined ? {} : { storageQuotaBytes: BigInt(storageQuotaBytes) }) };
      const updated = await client.project.updateMany({ where: { id, ownerId }, data });
      if (!updated.count) return { data: null };
      await auditRepository.createAuditRepository({ entity: 'Project', entityId: id, action: 'update', changes: Object.entries(fields).map(([fieldName, fieldValue]) => ({ fieldName, fieldValue })).concat(storageQuotaBytes === undefined ? [] : [{ fieldName: 'storageQuotaBytes', fieldValue: storageQuotaBytes }]), auditUserId, tx });
      return { data: await client.project.findFirst({ where: { id, ownerId } }) };
    },
    async deleteProjectRepository({ payload, auditUserId, tx }) {
      const client = tx ?? prisma;
      const project = await client.project.findFirst({ where: payload });
      if (!project) return { data: null };
      await client.project.delete({ where: { id: project.id } });
      await auditRepository.createAuditRepository({ entity: 'Project', entityId: project.id, action: 'delete', changes: [{ fieldName: 'name', fieldValue: project.name }], auditUserId, tx });
      return { data: project };
    },
  };
  return repository;
}
