import type { PrismaClient } from '@prisma/client';
import { listActivityQueryDto, type AuditLogView } from '../../../domain/audit/dto.js';
import type {
  AuditRecord,
  AuditRepositoryInterface,
  AuditUseCaseInterface,
} from '../../../domain/audit/interface.js';
import { AppError } from '../../../lib/app-error.js';
import { validateAndThrow } from '../../../lib/validate-and-throw.js';

const toView = (record: AuditRecord): AuditLogView => ({
  id: record.id,
  entity: record.entity,
  entityId: record.entityId,
  action: record.action,
  fieldName: record.fieldName,
  fieldValue: record.fieldValue,
  userId: record.userId,
  createdAt: record.createdAt.toISOString(),
});

export function buildAuditUseCase({
  repository,
  projectLookup,
}: {
  repository: AuditRepositoryInterface;
  prisma?: PrismaClient;
  projectLookup: (projectId: string, userId: string) => Promise<boolean>;
}): AuditUseCaseInterface {
  return {
    async listProjectActivityUseCase({ projectId, query, auditUserId }) {
      const allowed = await projectLookup(projectId, auditUserId);
      if (!allowed) {
        throw new AppError(404, 'NOT_FOUND', 'Project not found');
      }

      const params = validateAndThrow({ schema: listActivityQueryDto, data: query });
      const { data, metadata } = await repository.findActivityByProjectRepository({
        projectId,
        page: params.page,
        limit: params.limit,
      });

      return {
        message: 'Project activity retrieved successfully',
        data: data.map(toView),
        metadata: metadata ?? { page: params.page, limit: params.limit, total: data.length },
        success: true,
      };
    },
  };
}
