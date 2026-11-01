import { validateAndThrow } from '../../../lib/validate-and-throw.js';
import {
  listUserNoticesQueryDto,
  type UserNoticeView,
} from '../../../domain/user-notices/dto.js';
import type {
  UserNoticesRepositoryInterface,
  UserNoticesUseCaseInterface,
} from '../../../domain/user-notices/interface.js';

export class UserNoticesUseCase implements UserNoticesUseCaseInterface {
  constructor(private readonly repository: UserNoticesRepositoryInterface) {}

  async listNotices(
    userId: string,
    query: unknown,
  ): Promise<{ data: UserNoticeView[]; metadata: { page: number; limit: number; total: number } }> {
    const validated = validateAndThrow({
      schema: listUserNoticesQueryDto,
      data: query ?? {},
    });

    const result = await this.repository.findByUserId(userId, validated);
    return {
      data: result.data,
      metadata: {
        page: validated.page,
        limit: validated.limit,
        total: result.total,
      },
    };
  }

  async getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const count = await this.repository.getUnreadCount(userId);
    return { unreadCount: count };
  }

  async markAsRead(userId: string, noticeId: string): Promise<UserNoticeView> {
    return this.repository.markRead(userId, noticeId);
  }

  async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
    const count = await this.repository.markAllRead(userId);
    return { updatedCount: count };
  }
}
