import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { UnreadNotificationsStore } from './unread-notifications.store';

describe('UnreadNotificationsStore', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });

  it('combines project notifications and broadcast notices into the shared badge count', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const store = TestBed.inject(UnreadNotificationsStore);
    const http = TestBed.inject(HttpTestingController);

    store.refresh();

    http.expectOne('/notifications/unread-count').flush({ message: 'ok', data: { count: 3 }, success: true });
    expect(store.count()).toBe(0);
    http.expectOne('/me/notices/unread-count').flush({ message: 'ok', data: { unreadCount: 2 }, success: true });
    expect(store.count()).toBe(5);
  });
});
