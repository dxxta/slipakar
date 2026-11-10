import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { ErrorReporter } from '../../domain/error-reporting/interface.js';
import { claimSystemDemoProject } from './claim.js';

describe('claimSystemDemoProject', () => {
  it('transfers the system demo project once to an administrator and audits the assignment', async () => {
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'system-id' }) },
      project: {
        findFirst: vi.fn().mockResolvedValue({ id: 'demo-project' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = { $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)) } as unknown as PrismaClient;
    const errorReporter: ErrorReporter = { capture: vi.fn() };

    await claimSystemDemoProject({ prisma, userId: 'admin-id', userEmail: 'ADMIN@example.com', adminEmails: ['admin@example.com'], errorReporter });

    expect(tx.project.updateMany).toHaveBeenCalledWith({ where: { id: 'demo-project', ownerId: 'system-id' }, data: { ownerId: 'admin-id' } });
    expect(tx.auditLog.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ entity: 'Project', entityId: 'demo-project', fieldValue: 'demo project assigned', userId: 'admin-id' })] });
  });

  it('does nothing for non-admin users and swallows transfer failures', async () => {
    const prisma = { $transaction: vi.fn() } as unknown as PrismaClient;
    const errorReporter: ErrorReporter = { capture: vi.fn() };
    await claimSystemDemoProject({ prisma, userId: 'user-id', userEmail: 'user@example.com', adminEmails: ['admin@example.com'], errorReporter });
    expect(prisma.$transaction).not.toHaveBeenCalled();

    const error = new Error('database unavailable');
    const brokenPrisma = { $transaction: vi.fn().mockRejectedValue(error) } as unknown as PrismaClient;
    await expect(claimSystemDemoProject({ prisma: brokenPrisma, userId: 'admin-id', userEmail: 'admin@example.com', adminEmails: ['admin@example.com'], errorReporter })).resolves.toBeUndefined();
    expect(errorReporter.capture).toHaveBeenCalledWith(error, { source: 'demo-project-claim' });
  });
});
