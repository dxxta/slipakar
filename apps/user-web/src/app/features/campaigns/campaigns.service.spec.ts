import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CampaignsService } from './campaigns.service';

describe('CampaignsService', () => {
  let service: CampaignsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CampaignsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists campaigns', () => {
    let result: unknown;
    service.listCampaigns('p-1').subscribe((data) => (result = data));

    const req = http.expectOne('/projects/p-1/campaigns?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    expect(req.request.method).toBe('GET');
    req.flush({ message: 'ok', data: [{ id: 'c-1', status: 'draft' }], metadata: { page: 1, limit: 20, total: 1 }, success: true });

    expect(result).toEqual({ data: [{ id: 'c-1', status: 'draft' }], metadata: { page: 1, limit: 20, total: 1 } });
  });

  it('creates campaign', () => {
    let result: unknown;
    service
      .createCampaign('p-1', {
        emailTemplateId: 't-1',
        smtpConnectionId: 's-1',
        uploadId: 'u-1',
        emailColumn: 'email',
      })
      .subscribe((data) => (result = data));

    const req = http.expectOne('/projects/p-1/campaigns');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      emailTemplateId: 't-1',
      smtpConnectionId: 's-1',
      uploadId: 'u-1',
      emailColumn: 'email',
    });
    req.flush({ message: 'ok', data: { id: 'c-1', status: 'draft' }, success: true });

    expect(result).toEqual({ id: 'c-1', status: 'draft' });
  });

  it('sends campaign returning 202 status and result', () => {
    let result: unknown;
    service.sendCampaign('p-1', 'c-1').subscribe((data) => (result = data));

    const req = http.expectOne('/projects/p-1/campaigns/c-1/send');
    expect(req.request.method).toBe('POST');
    req.flush({
      message: 'Campaign accepted for sending',
      data: { campaignId: 'c-1', status: 'sending', enqueuedCount: 10 },
      success: true,
    });

    expect(result).toEqual({ campaignId: 'c-1', status: 'sending', enqueuedCount: 10 });
  });

  it('gets campaign detail with counts', () => {
    let result: unknown;
    service.getCampaign('p-1', 'c-1').subscribe((data) => (result = data));

    const req = http.expectOne('/projects/p-1/campaigns/c-1');
    expect(req.request.method).toBe('GET');
    req.flush({
      message: 'ok',
      data: {
        id: 'c-1',
        status: 'sending',
        counts: { pending: 5, sent: 3, failed: 2, total: 10 },
      },
      success: true,
    });

    expect(result).toEqual({
      id: 'c-1',
      status: 'sending',
      counts: { pending: 5, sent: 3, failed: 2, total: 10 },
    });
  });

  it('retries failed recipient', () => {
    let result: unknown;
    service.retryRecipient('p-1', 'c-1', 'r-1').subscribe((data) => (result = data));

    const req = http.expectOne('/projects/p-1/campaigns/c-1/recipients/r-1/retry');
    expect(req.request.method).toBe('POST');
    req.flush({
      message: 'Recipient reset to pending and enqueued',
      data: { id: 'r-1', status: 'pending' },
      success: true,
    });

    expect(result).toEqual({ id: 'r-1', status: 'pending' });
  });

  it('lists recipients with real pagination metadata via getPage', () => {
    let result: unknown;
    service.listRecipients('p-1', 'c-1', 1, 20, 'sent').subscribe((data) => (result = data));

    const req = http.expectOne('/projects/p-1/campaigns/c-1/recipients?page=1&limit=20&sortBy=rowIndex&sortDir=asc&status=sent');
    expect(req.request.method).toBe('GET');
    req.flush({
      message: 'Campaign recipients retrieved successfully',
      data: [{ id: 'r-1', email: 'test@example.com', status: 'sent', rowIndex: 0 }],
      metadata: { page: 1, limit: 20, total: 1 },
      success: true,
    });

    expect(result).toEqual({
      data: [{ id: 'r-1', email: 'test@example.com', status: 'sent', rowIndex: 0 }],
      metadata: { page: 1, limit: 20, total: 1 },
    });
  });
});
