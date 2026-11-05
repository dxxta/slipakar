import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignCreatePage } from './campaign-create-page';

describe('CampaignCreatePage', () => {
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CampaignCreatePage],
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

  function flushPrerequisites(options?: {
    templates?: Array<{ id: string; name: string; subject: string }>;
    uploads?: Array<{ id: string; fileName: string; columns: string[]; rowCount: number }>;
    smtp?: Array<{ id: string; host: string; port: number; username: string }>;
  }) {
    const tplReq = http.expectOne('/projects/p-1/templates?page=1&limit=100&sortBy=createdAt&sortDir=desc');
    tplReq.flush({
      message: 'ok',
      data: options?.templates ?? [{ id: 'tpl-1', name: 'Payslip', subject: 'Your Payslip' }],
      metadata: { page: 1, limit: 100, total: (options?.templates ?? [{ id: 'tpl-1' }]).length },
      success: true,
    });

    const pdfReq = http.expectOne('/projects/p-1/pdf-templates?page=1&limit=100&sortBy=createdAt&sortDir=desc');
    pdfReq.flush({ message: 'ok', data: [], metadata: { page: 1, limit: 100, total: 0 }, success: true });

    const upReq = http.expectOne('/projects/p-1/uploads');
    upReq.flush({
      message: 'ok',
      data: options?.uploads ?? [{ id: 'up-1', fileName: 'data.csv', columns: ['name', 'email'], rowCount: 10 }],
      success: true,
    });

    const smtpReq = http.expectOne('/projects/p-1/smtp?page=1&limit=100&sortBy=createdAt&sortDir=desc');
    smtpReq.flush({
      message: 'ok',
      data: options?.smtp ?? [{ id: 'smtp-1', host: 'smtp.mail.com', port: 587, username: 'user' }],
      metadata: { page: 1, limit: 100, total: (options?.smtp ?? [{ id: 'smtp-1' }]).length },
      success: true,
    });
  }

  it('loads prerequisites and warns if mapping is missing when template and upload are selected', () => {
    const fixture = TestBed.createComponent(CampaignCreatePage);
    fixture.detectChanges();

    flushPrerequisites();
    fixture.detectChanges();

    const tplSelect = fixture.nativeElement.querySelector('[data-testid="template-select"]') as HTMLSelectElement;
    tplSelect.value = 'tpl-1';
    tplSelect.dispatchEvent(new Event('change'));

    const upSelect = fixture.nativeElement.querySelector('[data-testid="upload-select"]') as HTMLSelectElement;
    upSelect.value = 'up-1';
    upSelect.dispatchEvent(new Event('change'));

    fixture.detectChanges();

    // Check mapping call is sent
    const mapReq = http.expectOne(
      '/projects/p-1/mappings?templateId=tpl-1&uploadId=up-1',
    );
    // Flush 404 (no mapping)
    mapReq.flush({ error: { message: 'Not found' } }, { status: 404, statusText: 'Not Found' });

    fixture.detectChanges();

    const warning = fixture.nativeElement.querySelector('[data-testid="no-mapping-warning"]');
    expect(warning).not.toBeNull();
    expect(warning.textContent).toContain('No field mapping found');
  });

  it('successfully creates campaign and navigates to detail page', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(CampaignCreatePage);
    fixture.detectChanges();

    flushPrerequisites();
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    comp.selectedTemplateId.set('tpl-1');
    comp.selectedUploadId.set('up-1');
    comp.selectedEmailColumn.set('email');
    comp.selectedSmtpId.set('smtp-1');

    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector('[data-testid="submit-create-campaign"]');
    submitBtn.click();

    const createReq = http.expectOne('/projects/p-1/campaigns');
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual({
      emailTemplateId: 'tpl-1',
      uploadId: 'up-1',
      emailColumn: 'email',
      smtpConnectionId: 'smtp-1',
    });

    createReq.flush({
      message: 'Campaign created successfully',
      data: { id: 'camp-new-123', status: 'draft' },
      success: true,
    });

    expect(navigateSpy).toHaveBeenCalledWith(['/projects', 'p-1', 'campaigns', 'camp-new-123']);
  });

  it('handles and displays API error on invalid recipient email format with offending rows', () => {
    const fixture = TestBed.createComponent(CampaignCreatePage);
    fixture.detectChanges();

    flushPrerequisites();
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    comp.selectedTemplateId.set('tpl-1');
    comp.selectedUploadId.set('up-1');
    comp.selectedEmailColumn.set('email');
    comp.selectedSmtpId.set('smtp-1');

    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector('[data-testid="submit-create-campaign"]');
    submitBtn.click();

    const createReq = http.expectOne('/projects/p-1/campaigns');
    createReq.flush(
      {
        error: {
          code: 'INVALID_RECIPIENT_EMAIL',
          message: 'Invalid recipient email format detected',
          details: { invalidRows: [2, 5] },
        },
      },
      { status: 400, statusText: 'Bad Request' },
    );

    fixture.detectChanges();

    const errorAlert = fixture.nativeElement.querySelector('[data-testid="campaign-create-error"]');
    expect(errorAlert).not.toBeNull();
    expect(errorAlert.textContent).toContain('Invalid recipient email format detected in upload file');
  });
});
