import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NotificationsPage } from './notifications-page';
import type { NotificationItem } from './notifications.service';

const mockProjects = [
  { id: 'proj-1', name: 'Project One' },
  { id: 'proj-2', name: 'Project Two' },
];

const mockNotifications: NotificationItem[] = [
  {
    id: 'notif-1',
    projectId: 'proj-1',
    campaignId: 'camp-123',
    type: 'campaign_finished',
    message: 'Campaign has completed sending to 10 recipients.',
    createdAt: '2026-11-08T14:30:00.000Z',
    readAt: null,
  },
  {
    id: 'notif-2',
    projectId: 'proj-1',
    campaignId: 'camp-456',
    type: 'send_failed',
    message: 'Campaign encountered an error sending to 2 recipients.',
    createdAt: '2026-11-08T13:00:00.000Z',
    readAt: null,
  },
  {
    id: 'notif-3',
    projectId: 'proj-1',
    campaignId: null,
    type: 'system_alert',
    message: 'System maintenance scheduled.',
    createdAt: '2026-11-08T10:00:00.000Z',
    readAt: null,
  },
];

describe('NotificationsPage', () => {
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NotificationsPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  it('renders loading skeleton initially while fetching projects and notifications', () => {
    const fixture = TestBed.createComponent(NotificationsPage);
    fixture.detectChanges();

    const skeleton = fixture.nativeElement.querySelector('[data-list-state="loading"]');
    expect(skeleton).not.toBeNull();

    // Respond to projects request
    const pReq = http.expectOne('/projects?page=1&limit=100&sortBy=createdAt&sortDir=desc');
    pReq.flush({ message: 'ok', data: mockProjects, success: true });

    // Respond to notifications request
    const nReq = http.expectOne('/projects/proj-1/notifications?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    nReq.flush({
      message: 'ok',
      data: mockNotifications,
      metadata: { page: 1, limit: 20, total: 3 },
      success: true,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-list-state="loading"]')).toBeNull();
  });

  it('renders empty state "You are all caught up" when no notifications exist', () => {
    const fixture = TestBed.createComponent(NotificationsPage);
    fixture.detectChanges();

    http.expectOne('/projects?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok',
      data: mockProjects,
      metadata: { page: 1, limit: 100, total: mockProjects.length },
      success: true,
    });
    http.expectOne('/projects/proj-1/notifications?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok',
      data: [],
      metadata: { page: 1, limit: 20, total: 0 },
      success: true,
    });
    fixture.detectChanges();

    const empty = fixture.nativeElement.querySelector('[data-list-state="empty"]');
    expect(empty).not.toBeNull();
    expect(empty.textContent).toContain('You are all caught up');
  });


  it('keeps notification filters and pagination visible when search has no matches', () => {
    const fixture = TestBed.createComponent(NotificationsPage);
    fixture.detectChanges();
    http.expectOne('/projects?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok', data: mockProjects, metadata: { page: 1, limit: 100, total: mockProjects.length }, success: true,
    });
    http.expectOne('/projects/proj-1/notifications?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok', data: mockNotifications, metadata: { page: 1, limit: 20, total: 3 }, success: true,
    });
    fixture.detectChanges();

    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = 'missing';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    http.expectOne('/projects/proj-1/notifications?page=1&limit=20&sortBy=createdAt&sortDir=desc&q=missing').flush({
      message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-data-table-controls')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('select[aria-label="Sort notifications"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-list-state="search-empty"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-pagination')).not.toBeNull();
  });

  it('renders notification items newest first with badges, message, relative time and campaign link', () => {
    const fixture = TestBed.createComponent(NotificationsPage);
    fixture.detectChanges();

    http.expectOne('/projects?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok',
      data: mockProjects,
      metadata: { page: 1, limit: 100, total: mockProjects.length },
      success: true,
    });
    http.expectOne('/projects/proj-1/notifications?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok',
      data: mockNotifications,
      metadata: { page: 1, limit: 20, total: 3 },
      success: true,
    });
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('[data-testid^="notification-item-"]');
    expect(rows.length).toBe(3);

    // Row 1: campaign_finished
    const firstRow = rows[0];
    expect(firstRow.textContent).toContain('Campaign Finished');
    expect(firstRow.textContent).toContain('Campaign has completed sending to 10 recipients.');
    const firstLink = firstRow.querySelector('[data-testid="campaign-link"]');
    expect(firstLink).not.toBeNull();
    expect(firstLink.getAttribute('href')).toBe('/projects/proj-1/campaigns/camp-123');

    // Relative time has title attribute with ISO string
    const timeEl = firstRow.querySelector('time');
    expect(timeEl).not.toBeNull();
    expect(timeEl.getAttribute('title')).toBe('2026-11-08T14:30:00.000Z');

    // Row 2: send_failed
    const secondRow = rows[1];
    expect(secondRow.textContent).toContain('Send Failed');
    expect(secondRow.textContent).toContain('Campaign encountered an error sending to 2 recipients.');

    // Row 3: campaignId null -> no campaign link
    const thirdRow = rows[2];
    expect(thirdRow.querySelector('[data-testid="campaign-link"]')).toBeNull();
  });

  it('renders error state with retry button and retries successfully', () => {
    const fixture = TestBed.createComponent(NotificationsPage);
    fixture.detectChanges();

    http.expectOne('/projects?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok',
      data: mockProjects,
      metadata: { page: 1, limit: 100, total: mockProjects.length },
      success: true,
    });
    http
      .expectOne('/projects/proj-1/notifications?page=1&limit=20&sortBy=createdAt&sortDir=desc')
      .flush({ error: { message: 'Server down' } }, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    const errorAlert = fixture.nativeElement.querySelector('[data-list-state="error"]');
    expect(errorAlert).not.toBeNull();

    const retryBtn = errorAlert.querySelector('button');
    expect(retryBtn).not.toBeNull();
    retryBtn.click();
    fixture.detectChanges();

    http.expectOne('/projects/proj-1/notifications?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok',
      data: mockNotifications,
      metadata: { page: 1, limit: 20, total: 3 },
      success: true,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-list-state="error"]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('[data-testid^="notification-item-"]').length).toBe(3);
  });

  it('supports previous and next page navigation at the end of the list', () => {
    const fixture = TestBed.createComponent(NotificationsPage);
    fixture.detectChanges();

    http.expectOne('/projects?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok',
      data: mockProjects,
      metadata: { page: 1, limit: 100, total: mockProjects.length },
      success: true,
    });
    http.expectOne('/projects/proj-1/notifications?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok',
      data: [mockNotifications[0]],
      metadata: { page: 1, limit: 20, total: 21 },
      success: true,
    });
    fixture.detectChanges();

    const nextPageButton = fixture.nativeElement.querySelector('[data-action="next-page"]') as HTMLButtonElement;
    expect(nextPageButton).not.toBeNull();
    nextPageButton.click();
    fixture.detectChanges();

    http.expectOne('/projects/proj-1/notifications?page=2&limit=20&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok',
      data: [mockNotifications[1]],
      metadata: { page: 2, limit: 20, total: 21 },
      success: true,
    });
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('[data-testid^="notification-item-"]');
    expect(rows.length).toBe(1);
    expect((fixture.nativeElement.querySelector('[data-action="previous-page"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('reloads notifications with unread=true when the unread-only toggle is enabled', () => {
    const fixture = TestBed.createComponent(NotificationsPage);
    fixture.detectChanges();
    http.expectOne('/projects?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok',
      data: mockProjects,
      metadata: { page: 1, limit: 100, total: mockProjects.length },
      success: true,
    });
    http.expectOne('/projects/proj-1/notifications?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok',
      data: mockNotifications,
      metadata: { page: 1, limit: 20, total: 3 },
      success: true,
    });
    fixture.detectChanges();

    const toggle = fixture.nativeElement.querySelector('input[aria-label="Unread only"]') as HTMLInputElement;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    http.expectOne('/projects/proj-1/notifications?page=1&limit=20&sortBy=createdAt&sortDir=desc&unread=true').flush({
      message: 'ok',
      data: mockNotifications.slice(0, 2),
      metadata: { page: 1, limit: 20, total: 2 },
      success: true,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-testid^="notification-item-"]').length).toBe(2);
  });

  it('optimistically marks one notification read and refreshes the unread badge count', () => {
    const fixture = TestBed.createComponent(NotificationsPage);
    fixture.detectChanges();
    http.expectOne('/projects?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok',
      data: mockProjects,
      metadata: { page: 1, limit: 100, total: mockProjects.length },
      success: true,
    });
    http.expectOne('/projects/proj-1/notifications?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok',
      data: mockNotifications,
      metadata: { page: 1, limit: 20, total: 3 },
      success: true,
    });
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      '[aria-label="Mark as read: Campaign has completed sending to 10 recipients."]'
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector(
        '[aria-label="Mark as read: Campaign has completed sending to 10 recipients."]'
      )
    ).toBeNull();

    http.expectOne('/projects/proj-1/notifications/notif-1/read').flush({
      message: 'ok',
      data: { ...mockNotifications[0], readAt: '2026-11-09T10:00:00.000Z' },
      success: true,
    });
    http.expectOne('/notifications/unread-count').flush({ message: 'ok', data: { count: 2 }, success: true });
    http.expectOne('/me/notices/unread-count').flush({ message: 'ok', data: { unreadCount: 1 }, success: true });
  });

  it('loads announcements using the strict notices query and marks a notice as read', () => {
    const fixture = TestBed.createComponent(NotificationsPage);
    fixture.detectChanges();
    http.expectOne('/projects?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok',
      data: mockProjects,
      metadata: { page: 1, limit: 100, total: mockProjects.length },
      success: true,
    });
    http.expectOne('/projects/proj-1/notifications?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok',
      data: mockNotifications,
      metadata: { page: 1, limit: 20, total: 3 },
      success: true,
    });
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('#segmented-tab-announcements') as HTMLButtonElement).click();
    const list = http.expectOne('/me/notices?page=1&limit=20');
    list.flush({
      message: 'ok',
      data: [
        {
          id: 'notice-1',
          userId: 'user-1',
          broadcastId: 'broadcast-1',
          title: 'Workspace news',
          message: 'A new feature is available.',
          readAt: null,
          createdAt: '2026-11-09T00:00:00.000Z',
        },
      ],
      metadata: { page: 1, limit: 20, total: 1 },
      success: true,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Workspace news');
    (
      fixture.nativeElement.querySelector(
        '[aria-label="Mark announcement as read: Workspace news"]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector(
        '[aria-label="Mark announcement as read: Workspace news"]'
      )
    ).toBeNull();
    const markRead = http.expectOne('/me/notices/notice-1/read');
    expect(markRead.request.method).toBe('PATCH');
    expect(markRead.request.body).toBeNull();
    markRead.flush({
      message: 'ok',
      data: {
        id: 'notice-1',
        userId: 'user-1',
        broadcastId: 'broadcast-1',
        title: 'Workspace news',
        message: 'A new feature is available.',
        readAt: '2026-11-09T01:00:00.000Z',
        createdAt: '2026-11-09T00:00:00.000Z',
      },
      success: true,
    });
    http.expectOne('/notifications/unread-count').flush({ message: 'ok', data: { count: 0 }, success: true });
    http.expectOne('/me/notices/unread-count').flush({ message: 'ok', data: { unreadCount: 0 }, success: true });
  });

  it('rolls back a failed read and shows an accessible error alert', () => {
    const fixture = TestBed.createComponent(NotificationsPage);
    fixture.detectChanges();
    http.expectOne('/projects?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok',
      data: mockProjects,
      metadata: { page: 1, limit: 100, total: mockProjects.length },
      success: true,
    });
    http.expectOne('/projects/proj-1/notifications?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok',
      data: mockNotifications,
      metadata: { page: 1, limit: 20, total: 3 },
      success: true,
    });
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector(
        '[aria-label="Mark as read: Campaign has completed sending to 10 recipients."]'
      ) as HTMLButtonElement
    ).click();
    http.expectOne('/projects/proj-1/notifications/notif-1/read').flush(
      { error: { code: 'ERROR', message: 'Failed' } },
      { status: 500, statusText: 'Error' }
    );
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector(
        '[aria-label="Mark as read: Campaign has completed sending to 10 recipients."]'
      )
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not mark notification as read'
    );
  });

  it('marks all unread notifications optimistically and disables the action when none remain', () => {
    const fixture = TestBed.createComponent(NotificationsPage);
    fixture.detectChanges();
    http.expectOne('/projects?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok',
      data: mockProjects,
      metadata: { page: 1, limit: 100, total: mockProjects.length },
      success: true,
    });
    http.expectOne('/projects/proj-1/notifications?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok',
      data: mockNotifications,
      metadata: { page: 1, limit: 20, total: 3 },
      success: true,
    });
    fixture.detectChanges();

    const markAll = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
    ).find((button) => button.textContent?.includes('Mark all as read')) as HTMLButtonElement;
    markAll.click();
    fixture.detectChanges();
    expect(markAll.disabled).toBe(true);
    http.expectOne('/projects/proj-1/notifications/read-all').flush({
      message: 'ok',
      data: { count: 3 },
      success: true,
    });
    http.expectOne('/notifications/unread-count').flush({ message: 'ok', data: { count: 0 }, success: true });
    http.expectOne('/me/notices/unread-count').flush({ message: 'ok', data: { unreadCount: 0 }, success: true });
    http.expectOne('/projects/proj-1/notifications?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({
      message: 'ok',
      data: mockNotifications.map((item) => ({ ...item, readAt: item.readAt ?? '2026-11-09T10:00:00.000Z' })),
      metadata: { page: 1, limit: 20, total: 3 },
      success: true,
    });
  });
});
