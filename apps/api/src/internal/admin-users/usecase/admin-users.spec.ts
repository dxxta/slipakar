import { describe, expect, it, vi } from 'vitest';
import { buildAdminUsersUseCase } from './admin-users.js';
import type { AdminUsersRepositoryInterface } from '../../../domain/admin-users/interface.js';
import type { PrismaClient } from '@prisma/client';

describe('Admin Users UseCase', () => {
  const mockRepository: AdminUsersRepositoryInterface = {
    listUsers: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn(),
    updateUser: vi.fn(),
    disableUser: vi.fn(),
    enableUser: vi.fn(),
    countActiveAdmins: vi.fn(),
  };

  const mockPrisma = {
    $transaction: vi.fn((fn) => fn({})),
  } as unknown as PrismaClient;

  const adminEmails = ['admin@example.com'];

  const useCase = buildAdminUsersUseCase({
    repository: mockRepository,
    prisma: mockPrisma,
    adminEmails,
  });

  it('rejects when an admin tries to disable themselves', async () => {
    vi.mocked(mockRepository.findById).mockResolvedValueOnce({
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      image: null,
      role: 'admin',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      disabledAt: null,
      disabledReason: null,
    });

    await expect(
      useCase.disableUser({
        id: 'admin-1',
        payload: {},
        auditUserId: 'admin-1',
      }),
    ).rejects.toMatchObject({
      code: 'CANNOT_DISABLE_SELF',
      status: 400,
    });
  });

  it('rejects disabling the last administrator', async () => {
    vi.mocked(mockRepository.findById).mockResolvedValueOnce({
      id: 'admin-2',
      email: 'admin@example.com',
      name: 'Admin',
      image: null,
      role: 'admin',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      disabledAt: null,
      disabledReason: null,
    });
    vi.mocked(mockRepository.countActiveAdmins).mockResolvedValueOnce(1);

    await expect(
      useCase.disableUser({
        id: 'admin-2',
        payload: {},
        auditUserId: 'admin-1',
      }),
    ).rejects.toMatchObject({
      code: 'LAST_ADMIN',
      status: 400,
    });
  });

  it('disables user successfully and revokes sessions', async () => {
    const disabledDate = new Date();
    vi.mocked(mockRepository.findById).mockResolvedValueOnce({
      id: 'user-2',
      email: 'regular@example.com',
      name: 'Regular',
      image: null,
      role: 'user',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      disabledAt: null,
      disabledReason: null,
    });
    vi.mocked(mockRepository.disableUser).mockResolvedValueOnce({
      id: 'user-2',
      email: 'regular@example.com',
      name: 'Regular',
      image: null,
      role: 'user',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      disabledAt: disabledDate,
      disabledReason: 'spam',
      _count: { projects: 1 },
    });

    const result = await useCase.disableUser({
      id: 'user-2',
      payload: { reason: 'spam' },
      auditUserId: 'admin-1',
    });

    expect(result.data.disabledAt).toBe(disabledDate.toISOString());
    expect(result.data.projectCount).toBe(1);
    expect(mockRepository.disableUser).toHaveBeenCalledWith({
      id: 'user-2',
      reason: 'spam',
      auditUserId: 'admin-1',
      tx: expect.anything(),
    });
  });

  describe('updateUser image validation', () => {
    const baseUser = {
      id: 'user-2',
      email: 'regular@example.com',
      name: 'Regular',
      image: null,
      role: 'user',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      disabledAt: null,
      disabledReason: null,
      _count: { projects: 1 },
    };

    it('accepts null, absolute https URLs, and own avatar path /me/avatar/<id>?v=<hex>', async () => {
      const validImages: Array<string | null> = [
        null,
        'https://example.com/avatar.png',
        'https://cdn.example.org/users/u-1/pic.webp?size=128',
        '/me/avatar/user-123_abc?v=a1b2c3d4',
        '/me/avatar/550e8400-e29b-41d4-a716-446655440000?v=deadbeef01234567',
      ];

      for (const image of validImages) {
        vi.mocked(mockRepository.findById).mockResolvedValueOnce(baseUser);
        vi.mocked(mockRepository.updateUser).mockResolvedValueOnce({
          ...baseUser,
          image,
        });

        const res = await useCase.updateUser({
          id: 'user-2',
          payload: { image },
          auditUserId: 'admin-1',
        });
        expect(res.data.image).toBe(image);
      }
    });

    it('rejects non-https URLs, other relative paths, dangerous schemes, and >2048 chars', async () => {
      const invalidImages = [
        'http://example.com/avatar.png',
        'javascript:alert(1)',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
        '/other/path/avatar.png',
        '/me/avatar/user-1',
        '/me/avatar/user-1?v=not_hex!',
        '/me/avatar/../secret?v=deadbeef',
        '/me/avatar/user-1?v=deadbeef&extra=1',
        `https://example.com/${'a'.repeat(2040)}`,
      ];

      for (const image of invalidImages) {
        vi.mocked(mockRepository.findById).mockResolvedValueOnce(baseUser);

        await expect(
          useCase.updateUser({
            id: 'user-2',
            payload: { image },
            auditUserId: 'admin-1',
          }),
        ).rejects.toMatchObject({
          status: 400,
        });
      }
    });
  });
});
