import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BroadcastsPage } from './broadcasts-page';

const draft = { id: 'b1', subject: 'Planned maintenance', bodyText: 'Hello {{name}}', audience: 'all', audienceFilter: null, status: 'draft', sentAt: null, createdBy: 'admin', counts: { total: 0, sent: 0, failed: 0 }, createdAt: '2026-11-09T00:00:00.000Z', updatedAt: '2026-11-09T00:00:00.000Z' };
const sent = { ...draft, id: 'b2', subject: 'Sent update', status: 'sent', sentAt: '2026-11-09T01:00:00.000Z', counts: { total: 4, sent: 4, failed: 0 } };

describe('BroadcastsPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [BroadcastsPage], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('renders draft and sent history with counts and loads through the paginated endpoint', () => {
    const fixture = TestBed.createComponent(BroadcastsPage);
    fixture.detectChanges();
    http.expectOne('/admin/broadcasts?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [draft, sent], metadata: { page: 1, limit: 20, total: 2 }, success: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Draft');
    expect(fixture.nativeElement.textContent).toContain('Sent');
    expect(fixture.nativeElement.textContent).toContain('4 sent');
    expect(fixture.nativeElement.querySelector('[aria-label="Actions for Planned maintenance"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Actions for Sent update"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="View Sent update"]')).not.toBeNull();
  });

  it('creates a draft, previews it, and sends only after confirmation', () => {
    const fixture = TestBed.createComponent(BroadcastsPage);
    fixture.detectChanges();
    http.expectOne('/admin/broadcasts?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[aria-label="Create broadcast"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('#broadcast-subject') as HTMLInputElement).value = 'Welcome';
    fixture.nativeElement.querySelector('#broadcast-subject').dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('#broadcast-body') as HTMLTextAreaElement).value = 'Hello all';
    fixture.nativeElement.querySelector('#broadcast-body').dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[aria-label="Preview broadcast"]') as HTMLButtonElement).click();
    const create = http.expectOne('/admin/broadcasts');
    expect(create.request.body).toEqual({ subject: 'Welcome', bodyText: 'Hello all', audience: 'all' });
    create.flush({ message: 'created', data: { ...draft, subject: 'Welcome', bodyText: 'Hello all' }, success: true });
    const preview = http.expectOne('/admin/broadcasts/b1/preview');
    preview.flush({ message: 'ok', data: { recipientCount: 3, sampleEmails: ['a***@example.test'], renderedSubject: 'Welcome', renderedBodyText: 'Hello all' }, success: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('3 recipients');
    (fixture.nativeElement.querySelector('[aria-label="Send broadcast"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
    (fixture.nativeElement.querySelector('[role="alertdialog"] [data-action="confirm"]') as HTMLButtonElement).click();
    const send = http.expectOne('/admin/broadcasts/b1/send');
    expect(send.request.body).toBeNull();
    send.flush({ message: 'sent', data: { ...draft, subject: 'Welcome', bodyText: 'Hello all', status: 'sent', counts: { total: 3, sent: 3, failed: 0 } }, success: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Broadcast sent');
  });
});
