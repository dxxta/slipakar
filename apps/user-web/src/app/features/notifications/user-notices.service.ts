import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { ApiClient, type PaginatedResponse } from '../../core/api-client';

export type UserNoticeItem = {
  id: string;
  userId: string;
  broadcastId?: string | null;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

@Injectable({ providedIn: 'root' })
export class UserNoticesService {
  private readonly api = inject(ApiClient);

  list(page = 1, limit = 20, unreadOnly = false): Observable<PaginatedResponse<UserNoticeItem>> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (unreadOnly) params.set('unreadOnly', 'true');
    return this.api.getPage<UserNoticeItem>(`/me/notices?${params.toString()}`);
  }

  unreadCount(): Observable<number> {
    return this.api.get<{ unreadCount: number }>('/me/notices/unread-count').pipe(map(({ unreadCount }) => unreadCount));
  }

  markRead(id: string): Observable<UserNoticeItem> {
    return this.api.patch<UserNoticeItem>(`/me/notices/${encodeURIComponent(id)}/read`, undefined);
  }

  markAllRead(): Observable<{ updatedCount: number }> {
    return this.api.post<{ updatedCount: number }>('/me/notices/mark-all-read', undefined);
  }
}
