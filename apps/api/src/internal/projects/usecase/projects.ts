import type { PrismaClient, Project } from '@prisma/client';
import type { ProjectsRepositoryInterface, ProjectsUseCaseInterface, ProjectView } from '../../../domain/projects/interface.js';
import { createProjectsDto, listProjectsQueryDto, updateProjectsDto } from '../../../domain/projects/dto.js';
import { AppError } from '../../../lib/app-error.js';
import { inTransaction } from '../../../lib/in-transaction.js';
import { validateAndThrow } from '../../../lib/validate-and-throw.js';

const toView = (project: Project): ProjectView => ({ ...project, storageQuotaBytes: project.storageQuotaBytes.toString() });
const notFound = (): AppError => new AppError(404, 'NOT_FOUND', 'Project not found');

export function buildProjectsUseCase({ repository, prisma }: { repository: ProjectsRepositoryInterface; prisma: PrismaClient }): ProjectsUseCaseInterface {
  const useCase: ProjectsUseCaseInterface = {
    async createProjectUseCase({ payload, auditUserId }) {
      const body = validateAndThrow({ schema: createProjectsDto, data: payload });
      const { data } = await inTransaction(prisma, (tx) => repository.createProjectRepository({ payload: { ...body, ownerId: auditUserId }, auditUserId, tx }));
      return { message: 'Project created successfully', data: toView(data), success: true };
    },
    async getProjectsUseCase({ query, auditUserId }) {
      const params = validateAndThrow({ schema: listProjectsQueryDto, data: query ?? {} });
      const { data, metadata } = await repository.getProjectsRepository({
        filter: { ownerId: auditUserId, ...(params.q ? { q: params.q } : {}) },
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      });
      return {
        message: 'Projects retrieved successfully',
        data: data.map(toView),
        metadata: metadata ?? { page: params.page, limit: params.limit, total: data.length },
        success: true,
      };
    },
    async getSingleProjectUseCase({ id, auditUserId }) {
      const { data } = await repository.getSingleProjectRepository({ filter: { id, ownerId: auditUserId } });
      if (!data) throw notFound();
      return { message: 'Project retrieved successfully', data: toView(data), success: true };
    },
    async updateProjectUseCase({ id, payload, auditUserId }) {
      const body = validateAndThrow({ schema: updateProjectsDto, data: payload });
      const { data } = await inTransaction(prisma, (tx) => repository.updateProjectRepository({ payload: { id, ownerId: auditUserId, ...body }, auditUserId, tx }));
      if (!data) throw notFound();
      return { message: 'Project updated successfully', data: toView(data), success: true };
    },
    async deleteProjectUseCase({ id, auditUserId }) {
      const { data } = await inTransaction(prisma, (tx) => repository.deleteProjectRepository({ payload: { id, ownerId: auditUserId }, auditUserId, tx }));
      if (!data) throw notFound();
      return { message: 'Project deleted successfully', data: toView(data), success: true };
    },
  };
  return useCase;
}
