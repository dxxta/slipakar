import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NotificationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('fetches paginated notifications and unwraps data and metadata', () => {
    let result: unknown;
    service.listNotifications('p-1', 1, 10).subscribe((res) => (result = res));

    const req = http.expectOne('/projects/p-1/notifications?page=1&limit=10&sortBy=createdAt&sortDir=desc');
    expect(req.request.method).toBe('GET');
    req.flush({
      message: 'Notifications retrieved successfully',
      data: [
        {
          id: 'n-1',
          projectId: 'p-1',
          campaignId: 'c-1',
          type: 'campaign_finished',
          message: 'Campaign completed',
          createdAt: '2026-11-08T12:00:00.000Z',
          readAt: null,
        },
      ],
      metadata: { page: 1, limit: 10, total: 1 },
      success: true,
    });

    expect(result).toEqual({
      data: [
        {
          id: 'n-1',
          projectId: 'p-1',
          campaignId: 'c-1',
          type: 'campaign_finished',
          message: 'Campaign completed',
          createdAt: '2026-11-08T12:00:00.000Z',
          readAt: null,
        },
      ],
      metadata: { page: 1, limit: 10, total: 1 },
    });
  });

  it('filters the list to unread notifications when requested', () => {
    service.listNotifications('p-1', 1, 20, true).subscribe();
    const req = http.expectOne('/projects/p-1/notifications?page=1&limit=20&sortBy=createdAt&sortDir=desc&unread=true');
    expect(req.request.method).toBe('GET');
    req.flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
  });

  it('marks one notification read and unwraps its view', () => {
    let result: unknown;
    service.markRead('p-1', 'n-1').subscribe((value) => (result = value));
    const req = http.expectOne('/projects/p-1/notifications/n-1/read');
    expect(req.request.method).toBe('POST');
    req.flush({ message: 'ok', data: { id: 'n-1', readAt: '2026-11-09T10:00:00.000Z' }, success: true });
    expect(result).toEqual({ id: 'n-1', readAt: '2026-11-09T10:00:00.000Z' });
  });

  it('marks all notifications read and returns the updated count', () => {
    let result: unknown;
    service.markAllRead('p-1').subscribe((value) => (result = value));
    const req = http.expectOne('/projects/p-1/notifications/read-all');
    expect(req.request.method).toBe('POST');
    req.flush({ message: 'ok', data: { count: 3 }, success: true });
    expect(result).toEqual({ count: 3 });
  });

  it('gets the signed-in user unread count', () => {
    let result: unknown;
    service.unreadCount().subscribe((value) => (result = value));
    const req = http.expectOne('/notifications/unread-count');
    expect(req.request.method).toBe('GET');
    req.flush({ message: 'ok', data: { count: 2 }, success: true });
    expect(result).toBe(2);
  });
});
