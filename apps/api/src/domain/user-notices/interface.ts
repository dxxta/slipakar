import type { ListUserNoticesQueryDto, UserNoticeView } from './dto.js';

export interface UserNoticesRepositoryInterface {
  findByUserId(
    userId: string,
    query: ListUserNoticesQueryDto,
  ): Promise<{ data: UserNoticeView[]; total: number }>;
  getUnreadCount(userId: string): Promise<number>;
  markRead(userId: string, noticeId: string): Promise<UserNoticeView>;
  markAllRead(userId: string): Promise<number>;
}

export interface UserNoticesUseCaseInterface {
  listNotices(
    userId: string,
    query: unknown,
  ): Promise<{ data: UserNoticeView[]; metadata: { page: number; limit: number; total: number } }>;
  getUnreadCount(userId: string): Promise<{ unreadCount: number }>;
  markAsRead(userId: string, noticeId: string): Promise<UserNoticeView>;
  markAllAsRead(userId: string): Promise<{ updatedCount: number }>;
}
