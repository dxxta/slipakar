import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignsListPage } from './campaigns-list-page';
import type { CampaignDetail, CampaignItem } from './campaigns.service';

const mockCampaigns: CampaignItem[] = [
  {
    id: 'camp-12345678-aaaa',
    projectId: 'p-1',
    emailTemplateId: 'tpl-1111-aaaa',
    smtpConnectionId: 'smtp-1',
    uploadId: 'up-1111-aaaa',
    emailColumn: 'email',
    status: 'draft',
    createdAt: '2026-11-08T12:00:00.000Z',
    updatedAt: '2026-11-08T12:00:00.000Z',
  },
  {
    id: 'camp-87654321-bbbb',
    projectId: 'p-1',
    emailTemplateId: 'tpl-2222-bbbb',
    smtpConnectionId: 'smtp-2',
    uploadId: 'up-2222-bbbb',
    emailColumn: 'email',
    status: 'completed',
    createdAt: '2026-11-08T14:00:00.000Z',
    updatedAt: '2026-11-08T14:05:00.000Z',
  },
];

const mockDetail1: CampaignDetail = {
  ...mockCampaigns[0],
  counts: { pending: 10, sent: 0, failed: 0, total: 10 },
};

const mockDetail2: CampaignDetail = {
  ...mockCampaigns[1],
  counts: { pending: 0, sent: 10, failed: 0, total: 10 },
};

describe('CampaignsListPage', () => {
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CampaignsListPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: (k: string) => (k === 'projectId' ? 'p-1' : null) } },
            parent: null,
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  it('shows loading skeleton while campaigns are loading', () => {
    const fixture = TestBed.createComponent(CampaignsListPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-page-header')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-data-table-controls')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-list-body [data-list-state="loading"]')).not.toBeNull();

    const skeleton = fixture.nativeElement.querySelector('app-list-body [data-list-state="loading"]');
    expect(skeleton).not.toBeNull();

    const req = http.expectOne('/projects/p-1/campaigns?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    expect(req.request.method).toBe('GET');
    req.flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
  });

  it('keeps the campaign filter mounted when a search returns no results', () => {
    const fixture = TestBed.createComponent(CampaignsListPage);
    fixture.detectChanges();
    http.expectOne('/projects/p-1/campaigns?page=1&limit=20&sortBy=createdAt&sortDir=desc')
      .flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();

    fixture.componentInstance.search('no match');
    fixture.detectChanges();
    http.expectOne('/projects/p-1/campaigns?page=1&limit=20&sortBy=createdAt&sortDir=desc&q=no+match')
      .flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-data-table-controls')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-list-state="search-empty"]')?.textContent).toContain('no match');
  });

  it('shows empty state when no campaigns exist', () => {
    const fixture = TestBed.createComponent(CampaignsListPage);
    fixture.detectChanges();

    const req = http.expectOne('/projects/p-1/campaigns?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    req.flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();

    const empty = fixture.nativeElement.querySelector('[data-list-state="empty"]');
    expect(empty).not.toBeNull();
    expect(empty.textContent).toContain('No campaigns yet');
  });

  it('shows error state with Retry button on API failure and retries successfully', () => {
    const fixture = TestBed.createComponent(CampaignsListPage);
    fixture.detectChanges();

    const req = http.expectOne('/projects/p-1/campaigns?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    req.flush({ error: { message: 'Server down' } }, { status: 500, statusText: 'Internal Error' });
    fixture.detectChanges();

    const errorState = fixture.nativeElement.querySelector('[data-list-state="error"]');
    expect(errorState).not.toBeNull();
    expect(errorState.textContent).toContain('Could not load campaigns');

    const retryBtn = errorState.querySelector('button');
    retryBtn.click();
    fixture.detectChanges();

    const retryReq = http.expectOne('/projects/p-1/campaigns?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    retryReq.flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-list-state="empty"]')).not.toBeNull();
  });

  it('renders campaigns table with name, badges, progress counts, and created date', () => {
    const fixture = TestBed.createComponent(CampaignsListPage);
    fixture.detectChanges();

    const req = http.expectOne('/projects/p-1/campaigns?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    req.flush({ message: 'ok', data: mockCampaigns, metadata: { page: 1, limit: 20, total: mockCampaigns.length }, success: true });

    // Expect detail calls for counts
    const d1 = http.expectOne('/projects/p-1/campaigns/camp-12345678-aaaa');
    d1.flush({ message: 'ok', data: mockDetail1, success: true });
    const d2 = http.expectOne('/projects/p-1/campaigns/camp-87654321-bbbb');
    d2.flush({ message: 'ok', data: mockDetail2, success: true });

    fixture.detectChanges();

    const row1 = fixture.nativeElement.querySelector('[data-testid="campaign-row-camp-12345678-aaaa"]');
    expect(row1).not.toBeNull();
    expect(row1.textContent).toContain('Campaign #camp-123');

    const badge1 = fixture.nativeElement.querySelector('[data-testid="status-badge-camp-12345678-aaaa"]');
    expect(badge1.textContent.trim()).toBe('Draft');

    const badge2 = fixture.nativeElement.querySelector('[data-testid="status-badge-camp-87654321-bbbb"]');
    expect(badge2.textContent.trim()).toBe('Completed');

    const counts2 = fixture.nativeElement.querySelector('[data-testid="counts-camp-87654321-bbbb"]');
    expect(counts2.textContent).toContain('10 sent');
  });

  it('navigates to create campaign page on button click', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(CampaignsListPage);
    fixture.detectChanges();

    const req = http.expectOne('/projects/p-1/campaigns?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    req.flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();

    const createBtn = fixture.nativeElement.querySelector('[data-testid="create-campaign-button"]');
    createBtn.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/projects', 'p-1', 'campaigns', 'new']);
  });
});
