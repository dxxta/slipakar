import type { Prisma, PrismaClient } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';
import type { NotificationsRepositoryInterface } from '../../../domain/notifications/interface.js';

export function buildNotificationsRepository({
  prisma,
  auditRepository,
}: {
  prisma: PrismaClient;
  auditRepository: AuditRepositoryInterface;
}): NotificationsRepositoryInterface {
  return {
    async createNotificationsRepository({ payload, auditUserId, tx }) {
      const client = tx ?? prisma;
      const data = await client.notification.create({
        data: {
          projectId: payload.projectId,
          campaignId: payload.campaignId,
          type: payload.type,
          message: payload.message,
        },
      });

      await auditRepository.createAuditRepository({
        entity: 'Notification',
        entityId: data.id,
        action: 'create',
        auditUserId,
        tx,
        changes: [
          { fieldName: 'type', fieldValue: data.type },
          { fieldName: 'message', fieldValue: data.message },
        ],
      });

      return { data };
    },

    async findAllNotificationsRepository({ filter, page, limit, sortBy = 'createdAt', sortDir = 'desc' }) {
      const skip = (page - 1) * limit;
      const where: Prisma.NotificationWhereInput = {
        projectId: filter.projectId,
        ...(filter.unread === undefined ? {} : { readAt: filter.unread ? null : { not: null } }),
        ...(filter.q ? {
          OR: [
            { type: { contains: filter.q, mode: 'insensitive' } },
            { message: { contains: filter.q, mode: 'insensitive' } },
          ],
        } : {}),
      };

      const [data, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { [sortBy]: sortDir },
          skip,
          take: limit,
        }),
        prisma.notification.count({
          where,
        }),
      ]);

      return {
        data,
        metadata: { page, limit, total },
      };
    },

    async markReadNotificationsRepository({ filter, readAt, auditUserId, tx }) {
      const client = tx ?? prisma;
      const existing = await client.notification.findFirst({
        where: { id: filter.id, projectId: filter.projectId },
      });
      if (!existing) return { data: null };
      if (existing.readAt) return { data: existing };

      const update = await client.notification.updateMany({
        where: { id: filter.id, projectId: filter.projectId, readAt: null },
        data: { readAt },
      });
      if (update.count > 0) {
        await auditRepository.createAuditRepository({
          entity: 'Notification',
          entityId: filter.id,
          action: 'update',
          auditUserId,
          tx,
          changes: [{ fieldName: 'readAt', fieldValue: readAt.toISOString() }],
        });
      }

      const data = await client.notification.findFirst({
        where: { id: filter.id, projectId: filter.projectId },
      });
      return { data };
    },

    async markAllReadNotificationsRepository({ filter, readAt, auditUserId, tx }) {
      const client = tx ?? prisma;
      const unreadNotifications = await client.notification.findMany({
        where: { projectId: filter.projectId, readAt: null },
        select: { id: true },
      });
      let count = 0;
      for (const notification of unreadNotifications) {
        const update = await client.notification.updateMany({
          where: { id: notification.id, projectId: filter.projectId, readAt: null },
          data: { readAt },
        });
        if (update.count === 0) continue;
        count += update.count;
        await auditRepository.createAuditRepository({
          entity: 'Notification',
          entityId: notification.id,
          action: 'update',
          auditUserId,
          tx,
          changes: [{ fieldName: 'readAt', fieldValue: readAt.toISOString() }],
        });
      }
      return { data: count };
    },

    async countUnreadNotificationsRepository({ filter }) {
      const data = await prisma.notification.count({
        where: { readAt: null, project: { ownerId: filter.userId } },
      });
      return { data };
    },
  };
}
