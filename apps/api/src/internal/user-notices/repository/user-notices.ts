import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  ListUserNoticesQueryDto,
  UserNoticeView,
} from '../../../domain/user-notices/dto.js';
import type { UserNoticesRepositoryInterface } from '../../../domain/user-notices/interface.js';
import { AppError } from '../../../lib/app-error.js';

export class UserNoticesRepository implements UserNoticesRepositoryInterface {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(
    userId: string,
    query: ListUserNoticesQueryDto,
  ): Promise<{ data: UserNoticeView[]; total: number }> {
    const where: Prisma.UserNoticeWhereInput = {
      userId,
      ...(query.unreadOnly && { readAt: null }),
    };

    const [total, rows] = await Promise.all([
      this.prisma.userNotice.count({ where }),
      this.prisma.userNotice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      total,
      data: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        broadcastId: r.broadcastId,
        title: r.title,
        message: r.message,
        readAt: r.readAt ? r.readAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.userNotice.count({
      where: {
        userId,
        readAt: null,
      },
    });
  }

  async markRead(userId: string, noticeId: string): Promise<UserNoticeView> {
    const notice = await this.prisma.userNotice.findUnique({
      where: { id: noticeId },
    });

    if (!notice || notice.userId !== userId) {
      throw new AppError(404, 'NOT_FOUND', 'Notice not found');
    }

    if (notice.readAt) {
      return {
        id: notice.id,
        userId: notice.userId,
        broadcastId: notice.broadcastId,
        title: notice.title,
        message: notice.message,
        readAt: notice.readAt ? notice.readAt.toISOString() : null,
        createdAt: notice.createdAt.toISOString(),
      };
    }

    const updated = await this.prisma.userNotice.update({
      where: { id: noticeId },
      data: { readAt: new Date() },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      broadcastId: updated.broadcastId,
      title: updated.title,
      message: updated.message,
      readAt: updated.readAt ? updated.readAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.prisma.userNotice.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return result.count;
  }
}
