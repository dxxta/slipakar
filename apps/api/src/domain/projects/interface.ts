import type { Prisma, Project } from '@prisma/client';
import type { RepositoryResponse, ResponseTypeWithMetadata, ResponseTypeWithoutMetadata } from '../../lib/types.js';
import type { CreateProjectsPayload, ListProjectsSortBy, UpdateProjectsPayload } from './dto.js';

export type ProjectView = Omit<Project, 'storageQuotaBytes'> & { storageQuotaBytes: string };

export type ProjectFilter = {
  ownerId: string;
  q?: string;
};

export interface ProjectsRepositoryInterface {
  createProjectRepository(input: { payload: CreateProjectsPayload & { ownerId: string }; auditUserId: string; tx?: Prisma.TransactionClient }): Promise<RepositoryResponse<Project>>;
  getProjectsRepository(input: {
    filter: ProjectFilter;
    page: number;
    limit: number;
    sortBy: ListProjectsSortBy;
    sortDir: 'asc' | 'desc';
  }): Promise<RepositoryResponse<Project[]>>;
  getSingleProjectRepository(input: { filter: { id: string; ownerId: string } }): Promise<RepositoryResponse<Project | null>>;
  updateProjectRepository(input: { payload: UpdateProjectsPayload & { id: string; ownerId: string }; auditUserId: string; tx?: Prisma.TransactionClient }): Promise<RepositoryResponse<Project | null>>;
  deleteProjectRepository(input: { payload: { id: string; ownerId: string }; auditUserId: string; tx?: Prisma.TransactionClient }): Promise<RepositoryResponse<Project | null>>;
}

export interface ProjectsUseCaseInterface {
  createProjectUseCase(input: { payload: unknown; auditUserId: string }): Promise<ResponseTypeWithoutMetadata<ProjectView>>;
  getProjectsUseCase(input: { query?: unknown; auditUserId: string }): Promise<ResponseTypeWithMetadata<ProjectView[]>>;
  getSingleProjectUseCase(input: { id: string; auditUserId: string }): Promise<ResponseTypeWithoutMetadata<ProjectView>>;
  updateProjectUseCase(input: { id: string; payload: unknown; auditUserId: string }): Promise<ResponseTypeWithoutMetadata<ProjectView>>;
  deleteProjectUseCase(input: { id: string; auditUserId: string }): Promise<ResponseTypeWithoutMetadata<ProjectView>>;
}
