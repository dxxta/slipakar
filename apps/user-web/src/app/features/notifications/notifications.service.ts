import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { ApiClient, type PageMetadata, type PaginatedResponse } from '../../core/api-client';

export interface NotificationItem {
  id: string;
  projectId: string;
  campaignId?: string | null;
  type: string;
  message: string;
  createdAt: string;
  readAt: string | null;
}

export type PaginationMetadata = PageMetadata;
export type PaginatedNotifications = PaginatedResponse<NotificationItem>;

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly api = inject(ApiClient);

  listNotifications(
    projectId: string,
    page = 1,
    limit = 20,
    unread = false,
    q = '',
    sortBy = 'createdAt',
    sortDir: 'asc' | 'desc' = 'desc',
  ): Observable<PaginatedNotifications> {
    const query = new URLSearchParams({ page: String(page), limit: String(limit), sortBy, sortDir });
    if (unread) query.set('unread', 'true');
    if (q.trim()) query.set('q', q.trim());
    const url = `/projects/${projectId}/notifications?${query.toString()}`;
    return this.api.getPage<NotificationItem>(url);
  }

  markRead(projectId: string, id: string): Observable<NotificationItem> {
    return this.api.post<NotificationItem>(`/projects/${projectId}/notifications/${id}/read`, undefined);
  }

  markAllRead(projectId: string): Observable<{ count: number }> {
    return this.api.post<{ count: number }>(`/projects/${projectId}/notifications/read-all`, undefined);
  }

  unreadCount(): Observable<number> {
    return this.api.get<{ count: number }>('/notifications/unread-count').pipe(map(({ count }) => count));
  }
}
