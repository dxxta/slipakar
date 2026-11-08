import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BroadcastsService, type BroadcastItem } from './broadcasts.service';

const broadcast: BroadcastItem = {
  id: 'broadcast-1', subject: 'Service update', bodyText: 'Hello {{name}}', audience: 'all',
  audienceFilter: null, status: 'draft', sentAt: null, createdBy: 'admin-1',
  counts: { total: 0, sent: 0, failed: 0 }, createdAt: '2026-11-09T00:00:00.000Z', updatedAt: '2026-11-09T00:00:00.000Z',
};

describe('BroadcastsService', () => {
  let http: HttpTestingController;
  let service: BroadcastsService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(BroadcastsService);
  });

  afterEach(() => http.verify());

  it('lists broadcasts with pagination and search, unwrapping the page envelope', () => {
    let result: { data: BroadcastItem[]; metadata: { page: number; limit: number; total: number } } | undefined;
    service.list({ page: 2, limit: 10, q: 'update', sortBy: 'subject', sortDir: 'asc' }).subscribe((value) => result = value);
    const request = http.expectOne('/admin/broadcasts?page=2&limit=10&sortBy=subject&sortDir=asc&q=update');
    request.flush({ message: 'ok', data: [broadcast], metadata: { page: 2, limit: 10, total: 11 }, success: true });
    expect(result).toEqual({ data: [broadcast], metadata: { page: 2, limit: 10, total: 11 } });
  });

  it('creates with only the strict API fields, previews, and sends without a body', () => {
    service.create({ subject: 'Service update', bodyText: 'Hello', audience: 'all' }).subscribe();
    const create = http.expectOne('/admin/broadcasts');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ subject: 'Service update', bodyText: 'Hello', audience: 'all' });
    create.flush({ message: 'created', data: broadcast, success: true });

    service.preview(broadcast.id).subscribe();
    http.expectOne({ method: 'POST', url: '/admin/broadcasts/broadcast-1/preview' }).flush({ message: 'ok', data: { recipientCount: 2, sampleEmails: ['a***@example.test'], renderedSubject: 'Service update', renderedBodyText: 'Hello' }, success: true });
    service.send(broadcast.id).subscribe();
    const send = http.expectOne('/admin/broadcasts/broadcast-1/send');
    expect(send.request.body).toBeNull();
    send.flush({ message: 'sent', data: { ...broadcast, status: 'sent' }, success: true });
  });
});
