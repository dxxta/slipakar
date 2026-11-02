import { Injectable, inject, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class UnreadNotificationsStore {
  private readonly api = inject(ApiClient);
  readonly count = signal(0);

  refresh(): void {
    forkJoin({
      projectNotifications: this.api.get<{ count: number }>('/notifications/unread-count').pipe(catchError(() => of({ count: 0 }))),
      userNotices: this.api.get<{ unreadCount: number }>('/me/notices/unread-count').pipe(catchError(() => of({ unreadCount: 0 }))),
    }).subscribe({
      next: ({ projectNotifications, userNotices }) => this.count.set(projectNotifications.count + userNotices.unreadCount),
    });
  }
}
