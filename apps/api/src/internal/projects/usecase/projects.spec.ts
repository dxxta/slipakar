import { describe, expect, it, vi } from 'vitest';
import type { Project } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { ProjectsRepositoryInterface } from '../../../domain/projects/interface.js';
import { buildProjectsUseCase } from './projects.js';

const project: Project = {
  id: 'project-1', ownerId: 'owner-1', name: 'Payroll', rateLimitPerMinute: 5,
  maxUploadBytes: 5_242_880, maxRows: 10_000, storageQuotaBytes: 1_073_741_824n,
  createdAt: new Date(), updatedAt: new Date(),
};

describe('projects usecase', () => {
  it('lists owner projects with pagination, sorting, search, and a serialized BigInt', async () => {
    const repository = {
      getProjectsRepository: vi.fn().mockResolvedValue({
        data: [project],
        metadata: { page: 1, limit: 20, total: 1 },
      }),
    } as unknown as ProjectsRepositoryInterface;
    const useCase = buildProjectsUseCase({ repository, prisma: {} as PrismaClient });
    expect(await useCase.getProjectsUseCase({ query: { page: '1', limit: '20', q: 'Pay', sortBy: 'name', sortDir: 'asc' }, auditUserId: 'owner-1' })).toEqual({
      message: 'Projects retrieved successfully', success: true,
      data: [{ ...project, storageQuotaBytes: '1073741824' }],
      metadata: { page: 1, limit: 20, total: 1 },
    });
    expect(repository.getProjectsRepository).toHaveBeenCalledWith({
      filter: { ownerId: 'owner-1', q: 'Pay' },
      page: 1,
      limit: 20,
      sortBy: 'name',
      sortDir: 'asc',
    });
  });

  it('returns NOT_FOUND for another owner', async () => {
    const repository = { getSingleProjectRepository: vi.fn().mockResolvedValue({ data: null }) } as unknown as ProjectsRepositoryInterface;
    const useCase = buildProjectsUseCase({ repository, prisma: {} as PrismaClient });
    await expect(useCase.getSingleProjectUseCase({ id: 'project-1', auditUserId: 'other' })).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});
