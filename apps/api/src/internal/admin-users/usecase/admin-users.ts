import type { PrismaClient, User } from '@prisma/client';
import type {
  AdminUsersRepositoryInterface,
  AdminUsersUseCaseInterface,
} from '../../../domain/admin-users/interface.js';
import type { AdminUserView } from '../../../domain/admin-users/dto.js';
import {
  listAdminUsersQueryDto,
  updateAdminUserDto,
  disableUserDto,
} from '../../../domain/admin-users/dto.js';
import { validateAndThrow } from '../../../lib/validate-and-throw.js';
import { AppError } from '../../../lib/app-error.js';
import { maskEmail } from '../../../lib/mask-email.js';
import type {
  ResponseTypeWithMetadata,
  ResponseTypeWithoutMetadata,
} from '../../../lib/types.js';

function toAdminUserView(user: User, viewerId: string): AdminUserView {
  return {
    id: user.id,
    email: user.id === viewerId ? user.email : maskEmail(user.email),
    name: user.name,
    image: user.image,
    role: user.role,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
    disabledAt: user.disabledAt ? user.disabledAt.toISOString() : null,
  };
}

export function buildAdminUsersUseCase({
  repository,
  prisma,
  adminEmails,
}: {
  repository: AdminUsersRepositoryInterface;
  prisma: PrismaClient;
  adminEmails: string[];
}): AdminUsersUseCaseInterface {
  const adminSet = new Set(adminEmails.map((e) => e.trim().toLowerCase()));

  return {
    async listUsers({
      query,
      auditUserId,
    }: {
      query: unknown;
      auditUserId: string;
    }): Promise<ResponseTypeWithMetadata<AdminUserView[]>> {
      const parsed = validateAndThrow({ schema: listAdminUsersQueryDto, data: query ?? {} });
      const result = await repository.listUsers(parsed);
      return {
        message: 'Users retrieved successfully',
        data: result.data.map((user) => toAdminUserView(user, auditUserId)),
        metadata: result.metadata ?? { page: parsed.page, limit: parsed.limit, total: result.data.length },
        success: true,
      };
    },

    async getUser({
      id,
      auditUserId,
    }: {
      id: string;
      auditUserId: string;
    }): Promise<ResponseTypeWithoutMetadata<AdminUserView>> {
      const user = await repository.findById(id);
      if (!user) {
        throw new AppError(404, 'NOT_FOUND', 'User not found');
      }
      return {
        message: 'User retrieved successfully',
        data: toAdminUserView(user, auditUserId),
        success: true,
      };
    },

    async updateUser({
      id,
      payload,
      auditUserId,
    }: {
      id: string;
      payload: unknown;
      auditUserId: string;
    }): Promise<ResponseTypeWithoutMetadata<AdminUserView>> {
      const user = await repository.findById(id);
      if (!user) {
        throw new AppError(404, 'NOT_FOUND', 'User not found');
      }
      const parsed = validateAndThrow({ schema: updateAdminUserDto, data: payload });
      const updated = await prisma.$transaction(async (tx) => {
        return repository.updateUser({
          id,
          payload: parsed,
          auditUserId,
          tx,
        });
      });

      return {
        message: 'User updated successfully',
        data: toAdminUserView(updated, auditUserId),
        success: true,
      };
    },

    async disableUser({
      id,
      payload,
      auditUserId,
    }: {
      id: string;
      payload: unknown;
      auditUserId: string;
    }): Promise<ResponseTypeWithoutMetadata<AdminUserView>> {
      const user = await repository.findById(id);
      if (!user) {
        throw new AppError(404, 'NOT_FOUND', 'User not found');
      }

      // Check: admin cannot disable themselves
      if (id === auditUserId) {
        throw new AppError(400, 'CANNOT_DISABLE_SELF', 'An admin cannot disable themselves');
      }

      // Check: admin cannot disable the last enabled admin
      const isTargetAdmin = adminSet.has(user.email.toLowerCase()) || user.role === 'admin';
      if (isTargetAdmin) {
        const activeAdmins = await repository.countActiveAdmins(adminEmails);
        if (activeAdmins <= 1) {
          throw new AppError(400, 'LAST_ADMIN', 'Cannot disable the last active administrator');
        }
      }

      const parsed = validateAndThrow({ schema: disableUserDto, data: payload ?? {} });
      const updated = await prisma.$transaction(async (tx) => {
        return repository.disableUser({
          id,
          reason: parsed.reason,
          auditUserId,
          tx,
        });
      });

      return {
        message: 'User disabled successfully',
        data: toAdminUserView(updated, auditUserId),
        success: true,
      };
    },

    async enableUser({
      id,
      auditUserId,
    }: {
      id: string;
      auditUserId: string;
    }): Promise<ResponseTypeWithoutMetadata<AdminUserView>> {
      const user = await repository.findById(id);
      if (!user) {
        throw new AppError(404, 'NOT_FOUND', 'User not found');
      }

      const updated = await prisma.$transaction(async (tx) => {
        return repository.enableUser({
          id,
          auditUserId,
          tx,
        });
      });

      return {
        message: 'User enabled successfully',
        data: toAdminUserView(updated, auditUserId),
        success: true,
      };
    },
  };
}
