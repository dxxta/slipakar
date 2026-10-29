import type { Notification, PrismaClient } from '@prisma/client';
import { listNotificationsQueryDto } from '../../../domain/notifications/dto.js';
import type {
  NotificationsRepositoryInterface,
  NotificationsUseCaseInterface,
  NotificationView,
} from '../../../domain/notifications/interface.js';
import type { NotifyMessage } from '../../../domain/queue/interface.js';
import { AppError } from '../../../lib/app-error.js';
import { inTransaction } from '../../../lib/in-transaction.js';
import { validateAndThrow } from '../../../lib/validate-and-throw.js';

function toView(notification: Notification): NotificationView {
  return {
    ...notification,
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt?.toISOString() ?? null,
  };
}

export function buildNotificationsUseCase({
  repository,
  prisma,
  projectLookup,
}: {
  repository: NotificationsRepositoryInterface;
  prisma: PrismaClient;
  projectLookup: (projectId: string, userId: string) => Promise<boolean>;
}): NotificationsUseCaseInterface {
  return {
    async handleNotify(message: NotifyMessage) {
      await inTransaction(prisma, (tx) =>
        repository.createNotificationsRepository({
          payload: {
            projectId: message.projectId,
            campaignId: message.campaignId,
            type: message.type,
            message: message.message,
          },
          auditUserId: 'system',
          tx,
        }),
      );
      // Structured logging without email addresses
      const sanitizedLog = JSON.stringify({
        level: 'info',
        event: 'notification',
        type: message.type,
        projectId: message.projectId,
        campaignId: message.campaignId,
        message: message.message,
      });
      console.log(sanitizedLog);
    },

    async listNotificationsUseCase({ projectId, query, auditUserId }) {
      const allowed = await projectLookup(projectId, auditUserId);
      if (!allowed) {
        throw new AppError(404, 'NOT_FOUND', 'Project not found');
      }

      const params = validateAndThrow({ schema: listNotificationsQueryDto, data: query });
      const unread = params.unread === undefined ? undefined : params.unread === 'true';
      const { data, metadata } = await repository.findAllNotificationsRepository({
        filter: {
          projectId,
          ...(unread === undefined ? {} : { unread }),
          ...(params.q ? { q: params.q } : {}),
        },
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      });

      return {
        message: 'Notifications retrieved successfully',
        data: data.map(toView),
        metadata: metadata ?? { page: params.page, limit: params.limit, total: data.length },
        success: true,
      };
    },

    async markReadNotificationUseCase({ projectId, id, auditUserId }) {
      const allowed = await projectLookup(projectId, auditUserId);
      if (!allowed) throw new AppError(404, 'NOT_FOUND', 'Project not found');

      const readAt = new Date();
      const { data } = await inTransaction(prisma, (tx) =>
        repository.markReadNotificationsRepository({
          filter: { projectId, id },
          readAt,
          auditUserId,
          tx,
        }),
      );
      if (!data) throw new AppError(404, 'NOT_FOUND', 'Notification not found');
      return {
        message: 'Notification marked read successfully',
        data: toView(data),
        success: true,
      };
    },

    async markAllNotificationsReadUseCase({ projectId, auditUserId }) {
      const allowed = await projectLookup(projectId, auditUserId);
      if (!allowed) throw new AppError(404, 'NOT_FOUND', 'Project not found');

      const { data: count } = await inTransaction(prisma, (tx) =>
        repository.markAllReadNotificationsRepository({
          filter: { projectId },
          readAt: new Date(),
          auditUserId,
          tx,
        }),
      );
      return {
        message: 'Notifications marked read successfully',
        data: { count },
        success: true,
      };
    },

    async getUnreadNotificationsCountUseCase({ auditUserId }) {
      const { data: count } = await repository.countUnreadNotificationsRepository({
        filter: { userId: auditUserId },
      });
      return {
        message: 'Unread notifications count retrieved successfully',
        data: { count },
        success: true,
      };
    },
  };
}
