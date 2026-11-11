import type { Prisma, PrismaClient, User } from '@prisma/client';
import type {
  AdminUsersRepositoryInterface,
} from '../../../domain/admin-users/interface.js';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';
import type {
  ListAdminUsersSortBy,
  UpdateAdminUserPayload,
} from '../../../domain/admin-users/dto.js';
import type { RepositoryResponse } from '../../../lib/types.js';

export function buildAdminUsersRepository({
  prisma,
  auditRepository,
}: {
  prisma: PrismaClient;
  auditRepository: AuditRepositoryInterface;
}): AdminUsersRepositoryInterface {
  return {
    async listUsers({
      page,
      limit,
      q,
      sortBy,
      sortDir,
    }: {
      page: number;
      limit: number;
      q?: string;
      sortBy: ListAdminUsersSortBy;
      sortDir: 'asc' | 'desc';
      }): Promise<RepositoryResponse<User[]>> {
      const where: Prisma.UserWhereInput = { role: { not: 'system' } };
      if (q) {
        // Email is masked for admins, so it must not be searchable either (it would reveal masked addresses).
        where.name = { contains: q, mode: 'insensitive' };
      }

      let orderBy: Prisma.UserOrderByWithRelationInput;
      if (sortBy === 'status') {
        // status is based on disabledAt: disabled if disabledAt is set
        orderBy = { disabledAt: sortDir };
      } else {
        orderBy = { [sortBy]: sortDir };
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.user.count({ where }),
      ]);

      return {
        data: users,
        metadata: { page, limit, total },
      };
    },

    async findById(id: string): Promise<User | null> {
      return prisma.user.findUnique({
        where: { id, role: { not: 'system' } },
      });
    },

    async findByEmail(email: string) {
      return prisma.user.findUnique({
        where: { email },
      });
    },

    async countActiveAdmins(adminEmails: string[]): Promise<number> {
      const lowercaseEmails = adminEmails.map((e) => e.trim().toLowerCase());
      return prisma.user.count({
        where: {
          email: { in: lowercaseEmails, mode: 'insensitive' },
          disabledAt: null,
          role: { not: 'system' },
        },
      });
    },

    async updateUser({
      id,
      payload,
      auditUserId,
      tx,
    }: {
      id: string;
      payload: UpdateAdminUserPayload;
      auditUserId: string;
      tx?: Prisma.TransactionClient;
    }): Promise<User> {
      const client = tx ?? prisma;
      const updated = await client.user.update({
        where: { id },
        data: {
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.image !== undefined ? { image: payload.image } : {}),
        },
      });

      const changes = [
        ...(payload.name !== undefined ? [{ fieldName: 'name', fieldValue: payload.name }] : []),
        ...(payload.image !== undefined ? [{ fieldName: 'image', fieldValue: payload.image }] : []),
      ];

      if (changes.length > 0) {
        await auditRepository.createAuditRepository({
          entity: 'User',
          entityId: id,
          action: 'update',
          changes,
          auditUserId,
          tx,
        });
      }

      return updated;
    },

    async disableUser({
      id,
      reason,
      auditUserId,
      tx,
    }: {
      id: string;
      reason?: string;
      auditUserId: string;
      tx?: Prisma.TransactionClient;
    }): Promise<User> {
      const client = tx ?? prisma;
      const now = new Date();

      // Delete existing sessions so existing tokens are immediately revoked
      await client.session.deleteMany({
        where: { userId: id },
      });

      const updated = await client.user.update({
        where: { id },
        data: {
          disabledAt: now,
          disabledReason: reason ?? null,
        },
      });

      await auditRepository.createAuditRepository({
        entity: 'User',
        entityId: id,
        action: 'update',
        changes: [
          { fieldName: 'disabledAt', fieldValue: now.toISOString() },
          ...(reason ? [{ fieldName: 'disabledReason', fieldValue: reason }] : []),
        ],
        auditUserId,
        tx,
      });

      return updated;
    },

    async enableUser({
      id,
      auditUserId,
      tx,
    }: {
      id: string;
      auditUserId: string;
      tx?: Prisma.TransactionClient;
    }): Promise<User> {
      const client = tx ?? prisma;
      const updated = await client.user.update({
        where: { id },
        data: {
          disabledAt: null,
          disabledReason: null,
        },
      });

      await auditRepository.createAuditRepository({
        entity: 'User',
        entityId: id,
        action: 'update',
        changes: [{ fieldName: 'disabledAt', fieldValue: null }],
        auditUserId,
        tx,
      });

      return updated;
    },
  };
}
