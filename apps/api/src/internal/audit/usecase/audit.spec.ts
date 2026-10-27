import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';
import { buildAuditUseCase } from './audit.js';

describe('audit usecase', () => {
  it('lists activity for a project and its children with pagination', async () => {
    const repository: AuditRepositoryInterface = {
      createAuditRepository: vi.fn(),
      findActivityByProjectRepository: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'audit-1',
            entity: 'Project',
            entityId: 'proj-1',
            action: 'create',
            fieldName: 'name',
            fieldValue: 'My Project',
            userId: 'user-1',
            createdAt: new Date('2026-11-09T00:00:00.000Z'),
          },
        ],
        metadata: { page: 1, limit: 20, total: 1 },
      }),
    };

    const projectLookup = vi.fn().mockResolvedValue(true);
    const useCase = buildAuditUseCase({ repository, prisma: {} as PrismaClient, projectLookup });

    const result = await useCase.listProjectActivityUseCase({
      projectId: 'proj-1',
      query: { page: '1', limit: '20' },
      auditUserId: 'user-1',
    });

    expect(result).toEqual({
      message: 'Project activity retrieved successfully',
      data: [
        {
          id: 'audit-1',
          entity: 'Project',
          entityId: 'proj-1',
          action: 'create',
          fieldName: 'name',
          fieldValue: 'My Project',
          userId: 'user-1',
          createdAt: '2026-11-09T00:00:00.000Z',
        },
      ],
      metadata: { page: 1, limit: 20, total: 1 },
      success: true,
    });
    expect(projectLookup).toHaveBeenCalledWith('proj-1', 'user-1');
  });

  it('rejects with 404 when user does not own project', async () => {
    const repository: AuditRepositoryInterface = {
      createAuditRepository: vi.fn(),
      findActivityByProjectRepository: vi.fn(),
    };
    const projectLookup = vi.fn().mockResolvedValue(false);
    const useCase = buildAuditUseCase({ repository, prisma: {} as PrismaClient, projectLookup });

    await expect(
      useCase.listProjectActivityUseCase({
        projectId: 'proj-1',
        query: {},
        auditUserId: 'intruder',
      }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});
