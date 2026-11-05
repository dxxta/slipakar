import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UserNoticesService } from './user-notices.service';

describe('UserNoticesService', () => {
  let service: UserNoticesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(UserNoticesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists notices with the API unreadOnly query name', () => {
    service.list(1, 20, true).subscribe();
    const request = http.expectOne('/me/notices?page=1&limit=20&unreadOnly=true');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
  });

  it('marks notices read and retrieves the unread count using their exact response shapes', () => {
    service.markRead('notice-1').subscribe();
    const markRead = http.expectOne('/me/notices/notice-1/read');
    expect(markRead.request.method).toBe('PATCH');
    expect(markRead.request.body).toBeNull();
    markRead.flush({ message: 'ok', data: { id: 'notice-1', userId: 'user-1', title: 'Hello', message: 'Body', readAt: '2026-11-09T00:00:00.000Z', createdAt: '2026-11-08T00:00:00.000Z' }, success: true });

    service.unreadCount().subscribe();
    http.expectOne('/me/notices/unread-count').flush({ message: 'ok', data: { unreadCount: 2 }, success: true });
    service.markAllRead().subscribe();
    const markAll = http.expectOne('/me/notices/mark-all-read');
    expect(markAll.request.method).toBe('POST');
    expect(markAll.request.body).toBeNull();
    markAll.flush({ message: 'ok', data: { updatedCount: 2 }, success: true });
  });
});
