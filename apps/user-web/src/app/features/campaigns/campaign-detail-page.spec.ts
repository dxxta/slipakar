import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignDetailPage } from './campaign-detail-page';
import type { CampaignDetail, CampaignRecipientItem } from './campaigns.service';

const mockDraftCampaign: CampaignDetail = {
  id: 'camp-1',
  projectId: 'p-1',
  emailTemplateId: 'tpl-1',
  smtpConnectionId: 'smtp-1',
  uploadId: 'up-1',
  emailColumn: 'email',
  status: 'draft',
  createdAt: '2026-11-08T12:00:00.000Z',
  updatedAt: '2026-11-08T12:00:00.000Z',
  counts: { pending: 2, sent: 0, failed: 0, total: 2 },
};

const mockSendingCampaign: CampaignDetail = {
  ...mockDraftCampaign,
  status: 'sending',
  counts: { pending: 1, sent: 1, failed: 0, total: 2 },
};

const mockCompletedCampaign: CampaignDetail = {
  ...mockDraftCampaign,
  status: 'completed',
  counts: { pending: 0, sent: 2, failed: 0, total: 2 },
};

const mockRecipients: CampaignRecipientItem[] = [
  {
    id: 'r-1',
    campaignId: 'camp-1',
    rowIndex: 0,
    email: 'alice@example.com',
    status: 'sent',
    errorMessage: null,
  },
  {
    id: 'r-2',
    campaignId: 'camp-1',
    rowIndex: 1,
    email: 'bob@example.com',
    status: 'failed',
    errorMessage: 'SMTP 550 Mailbox unavailable',
  },
];

describe('CampaignDetailPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CampaignDetailPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (k: string) => {
                  if (k === 'projectId') return 'p-1';
                  if (k === 'campaignId') return 'camp-1';
                  return null;
                },
              },
            },
            parent: null,
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('renders campaign summary and recipient table with statuses and error messages', () => {
    const fixture = TestBed.createComponent(CampaignDetailPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-back-button a')?.getAttribute('aria-label')).toBe('Back to campaigns');
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Campaign #');

    const campReq = http.expectOne('/projects/p-1/campaigns/camp-1');
    campReq.flush({ message: 'ok', data: mockDraftCampaign, success: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-data-table-controls')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-list-body [data-list-state="loading"]')).not.toBeNull();

    const recsReq = http.expectOne('/projects/p-1/campaigns/camp-1/recipients?page=1&limit=20&sortBy=rowIndex&sortDir=asc');
    recsReq.flush({
      message: 'ok',
      data: mockRecipients,
      metadata: { page: 1, limit: 20, total: 2 },
      success: true,
    });

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="count-total"]').textContent.trim()).toBe('2');
    expect(fixture.nativeElement.querySelector('[data-testid="recipient-row-r-1"]').textContent).toContain('alice@example.com');
    expect(fixture.nativeElement.querySelector('[data-testid="recipient-badge-r-1"]').textContent.trim()).toBe('sent');

    expect(fixture.nativeElement.querySelector('[data-testid="recipient-row-r-2"]').textContent).toContain('bob@example.com');
    expect(fixture.nativeElement.querySelector('[data-testid="recipient-badge-r-2"]').textContent.trim()).toBe('failed');
    expect(fixture.nativeElement.querySelector('[data-testid="recipient-error-r-2"]').textContent).toContain('SMTP 550 Mailbox unavailable');

    // Retry button visible for failed recipient
    expect(fixture.nativeElement.querySelector('[data-testid="retry-recipient-r-2"]')).not.toBeNull();
  });

  it('keeps recipient filters and pagination visible for a search-empty result', () => {
    const fixture = TestBed.createComponent(CampaignDetailPage);
    fixture.detectChanges();
    http.expectOne('/projects/p-1/campaigns/camp-1').flush({ message: 'ok', data: mockDraftCampaign, success: true });
    http.expectOne('/projects/p-1/campaigns/camp-1/recipients?page=1&limit=20&sortBy=rowIndex&sortDir=asc')
      .flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();

    fixture.componentInstance.searchRecipients('missing@example.com');
    fixture.detectChanges();
    http.expectOne('/projects/p-1/campaigns/camp-1/recipients?page=1&limit=20&sortBy=rowIndex&sortDir=asc&q=missing%40example.com')
      .flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-data-table-controls')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-pagination')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-list-state="search-empty"]')?.textContent).toContain('missing@example.com');
  });

  it('sends campaign with confirmation dialog stating recipient count', () => {
    const fixture = TestBed.createComponent(CampaignDetailPage);
    fixture.detectChanges();

    const campReq = http.expectOne('/projects/p-1/campaigns/camp-1');
    campReq.flush({ message: 'ok', data: mockDraftCampaign, success: true });
    const recsReq = http.expectOne('/projects/p-1/campaigns/camp-1/recipients?page=1&limit=20&sortBy=rowIndex&sortDir=asc');
    recsReq.flush({
      message: 'ok',
      data: mockRecipients,
      metadata: { page: 1, limit: 20, total: 2 },
      success: true,
    });
    fixture.detectChanges();

    const sendBtn = fixture.nativeElement.querySelector('[data-testid="send-campaign-button"]');
    sendBtn.click();
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[data-testid="send-confirm-dialog"]');
    expect(dialog).not.toBeNull();
    const confirmMsg = fixture.nativeElement.querySelector('[data-testid="confirm-send-message"]');
    expect(confirmMsg.textContent).toContain('2');

    const confirmBtn = fixture.nativeElement.querySelector('[data-testid="confirm-send-button"]');
    confirmBtn.click();

    const sendReq = http.expectOne('/projects/p-1/campaigns/camp-1/send');
    expect(sendReq.request.method).toBe('POST');
    sendReq.flush({
      message: 'Campaign accepted for sending',
      data: { campaignId: 'camp-1', status: 'sending', enqueuedCount: 2 },
      success: true,
    });

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="send-confirm-dialog"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="campaign-action-success"]').textContent).toContain(
      'Campaign is now sending (2 recipients enqueued)',
    );
  });

  it('handles 409 conflict when campaign is already sending and shows friendly message', () => {
    const fixture = TestBed.createComponent(CampaignDetailPage);
    fixture.detectChanges();

    const campReq = http.expectOne('/projects/p-1/campaigns/camp-1');
    campReq.flush({ message: 'ok', data: mockDraftCampaign, success: true });
    const recsReq = http.expectOne('/projects/p-1/campaigns/camp-1/recipients?page=1&limit=20&sortBy=rowIndex&sortDir=asc');
    recsReq.flush({
      message: 'ok',
      data: mockRecipients,
      metadata: { page: 1, limit: 20, total: 2 },
      success: true,
    });
    fixture.detectChanges();

    const sendBtn = fixture.nativeElement.querySelector('[data-testid="send-campaign-button"]');
    sendBtn.click();
    fixture.detectChanges();

    const confirmBtn = fixture.nativeElement.querySelector('[data-testid="confirm-send-button"]');
    confirmBtn.click();

    const sendReq = http.expectOne('/projects/p-1/campaigns/camp-1/send');
    sendReq.flush(
      { error: { code: 'CAMPAIGN_ALREADY_SENT', message: 'Campaign is not in draft status' } },
      { status: 409, statusText: 'Conflict' },
    );

    fixture.detectChanges();

    const errorAlert = fixture.nativeElement.querySelector('[data-testid="campaign-action-error"]');
    expect(errorAlert).not.toBeNull();
    expect(errorAlert.textContent).toContain('This campaign has already been sent or is currently sending.');
  });

  it('starts polling every 3 seconds while status is sending, and stops when completed with aria-live announcement', () => {
    vi.useFakeTimers();

    const fixture = TestBed.createComponent(CampaignDetailPage);
    fixture.detectChanges();

    const campReq = http.expectOne('/projects/p-1/campaigns/camp-1');
    campReq.flush({ message: 'ok', data: mockSendingCampaign, success: true });
    const recsReq = http.expectOne('/projects/p-1/campaigns/camp-1/recipients?page=1&limit=20&sortBy=rowIndex&sortDir=asc');
    recsReq.flush({
      message: 'ok',
      data: mockRecipients,
      metadata: { page: 1, limit: 20, total: 2 },
      success: true,
    });
    fixture.detectChanges();

    // Advance 3000ms using vitest fake timers
    vi.advanceTimersByTime(3000);

    const pollCamp = http.expectOne('/projects/p-1/campaigns/camp-1');
    pollCamp.flush({ message: 'ok', data: mockCompletedCampaign, success: true });
    const pollRecs = http.expectOne('/projects/p-1/campaigns/camp-1/recipients?page=1&limit=20&sortBy=rowIndex&sortDir=asc');
    pollRecs.flush({
      message: 'ok',
      data: mockRecipients,
      metadata: { page: 1, limit: 20, total: 2 },
      success: true,
    });
    fixture.detectChanges();

    const announcement = fixture.nativeElement.querySelector('[data-testid="live-status-announcement"]');
    expect(announcement.textContent).toContain('Campaign status changed to Completed');

    // Advance another 3000ms -> should NOT trigger another request since it completed
    vi.advanceTimersByTime(3000);
    http.expectNone('/projects/p-1/campaigns/camp-1');

    fixture.destroy();
  });
});
