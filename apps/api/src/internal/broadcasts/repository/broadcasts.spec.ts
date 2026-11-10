import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';
import { BroadcastRepository } from './broadcasts.js';

describe('broadcast repository system-account filtering', () => {
  it('excludes the system owner from all and role recipient audiences', async () => {
    const user = { findMany: vi.fn().mockResolvedValue([]) };
    const repository = new BroadcastRepository({ user } as unknown as PrismaClient, {} as AuditRepositoryInterface);

    await repository.resolveRecipients('all');
    expect(user.findMany.mock.calls[0][0]?.where).toMatchObject({ disabledAt: null, role: { not: 'system' } });
    await repository.resolveRecipients('role', { role: 'admin' });
    expect(user.findMany.mock.calls[1][0]?.where).toMatchObject({ disabledAt: null, role: 'admin', AND: [{ role: { not: 'system' } }] });
  });
});
