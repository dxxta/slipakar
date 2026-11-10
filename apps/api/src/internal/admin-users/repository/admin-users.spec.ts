import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';
import { buildAdminUsersRepository } from './admin-users.js';

describe('admin users repository system-account filtering', () => {
  it('hides the system owner from list and detail queries', async () => {
    const user = {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue(null),
    };
    const repository = buildAdminUsersRepository({
      prisma: { user } as unknown as PrismaClient,
      auditRepository: {} as AuditRepositoryInterface,
    });

    await repository.listUsers({ page: 1, limit: 20, sortBy: 'createdAt', sortDir: 'desc' });
    await repository.findById('system-id');

    expect(user.findMany.mock.calls[0][0]?.where).toMatchObject({ role: { not: 'system' } });
    expect(user.count.mock.calls[0][0]?.where).toMatchObject({ role: { not: 'system' } });
    expect(user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'system-id', role: { not: 'system' } } }));
  });
});
