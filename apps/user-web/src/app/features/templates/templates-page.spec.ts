import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TemplatesPage } from './templates-page';
import type { EmailTemplate } from './templates.service';

const mockTemplate: EmailTemplate = {
  id: 'tpl-1',
  projectId: 'p-1',
  name: 'Monthly Payroll',
  subject: 'Your Payslip for {{period}}',
  bodyHtml: '<p>Dear {{name}},</p><p>Your pay is {{amount}}.</p>',
};

function chooseTemplateAction(fixture: ComponentFixture<TemplatesPage>, label: string): void {
  const trigger = fixture.nativeElement.querySelector('[data-testid="template-actions-tpl-1"] button') as HTMLButtonElement;
  trigger.click();
  fixture.detectChanges();
  const action = [...(fixture.nativeElement as HTMLElement).querySelectorAll('[role="menuitem"]')]
    .find((item) => item.textContent?.trim() === label) as HTMLButtonElement | undefined;
  if (!action) throw new Error(`Could not find template action ${label}`);
  action.click();
  fixture.detectChanges();
}

describe('TemplatesPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [TemplatesPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: (key: string) => (key === 'projectId' ? 'p-1' : null) } },
            parent: null,
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('shows loading skeleton while templates are being loaded', () => {
    const fixture = TestBed.createComponent(TemplatesPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-page-header')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-data-table-controls')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-list-body [data-list-state="loading"]')).not.toBeNull();

    const skeleton = fixture.nativeElement.querySelector('app-list-body [data-list-state="loading"]');
    expect(skeleton).not.toBeNull();

    const req = http.expectOne('/projects/p-1/templates?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    expect(req.request.method).toBe('GET');
    req.flush({ message: 'ok', data: [mockTemplate], metadata: { page: 1, limit: 20, total: 1 }, success: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-list-body [data-list-state="loading"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Monthly Payroll');
  });

  it('keeps filters mounted and shows a search-empty state with a clear action', () => {
    const fixture = TestBed.createComponent(TemplatesPage);
    fixture.detectChanges();
    http.expectOne('/projects/p-1/templates?page=1&limit=20&sortBy=createdAt&sortDir=desc')
      .flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();

    fixture.componentInstance.searchTemplates('missing');
    fixture.detectChanges();
    http.expectOne('/projects/p-1/templates?page=1&limit=20&sortBy=createdAt&sortDir=desc&q=missing')
      .flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-data-table-controls')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-list-state="search-empty"]')?.textContent).toContain('missing');
    (fixture.nativeElement.querySelector('[data-action="clear-search"]') as HTMLButtonElement).click();
    expect(fixture.componentInstance.listQuery()).toBe('');
    http.expectOne('/projects/p-1/templates?page=1&limit=20&sortBy=createdAt&sortDir=desc')
      .flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
  });

  it('shows empty state when no templates exist', () => {
    const fixture = TestBed.createComponent(TemplatesPage);
    fixture.detectChanges();

    const req = http.expectOne('/projects/p-1/templates?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    req.flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-list-state="empty"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No templates yet');
  });

  it('shows error state with Retry button on load failure', () => {
    const fixture = TestBed.createComponent(TemplatesPage);
    fixture.detectChanges();

    const req = http.expectOne('/projects/p-1/templates?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    req.flush({ error: { code: 'INTERNAL', message: 'Failed to retrieve templates' } }, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    const errState = fixture.nativeElement.querySelector('[data-list-state="error"]');
    expect(errState).not.toBeNull();
    expect(errState.textContent).toContain('Failed to retrieve templates');

    const retryBtn = errState.querySelector('button') as HTMLButtonElement;
    retryBtn.click();
    fixture.detectChanges();

    const retryReq = http.expectOne('/projects/p-1/templates?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    retryReq.flush({ message: 'ok', data: [mockTemplate], metadata: { page: 1, limit: 20, total: 1 }, success: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-list-state="error"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Monthly Payroll');
  });

  it('creates a template and sends POST /projects/:projectId/templates', () => {
    const fixture = TestBed.createComponent(TemplatesPage);
    fixture.detectChanges();

    http.expectOne('/projects/p-1/templates?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="empty-add-template-button"]').click();
    fixture.detectChanges();

    const nameInput = fixture.nativeElement.querySelector('[data-testid="template-name-input"]') as HTMLInputElement;
    const subjectInput = fixture.nativeElement.querySelector('[data-testid="template-subject-input"]') as HTMLInputElement;
    const bodyTextarea = fixture.nativeElement.querySelector('[data-testid="template-body-textarea"]') as HTMLTextAreaElement;

    nameInput.value = 'Welcome Email';
    nameInput.dispatchEvent(new Event('input'));
    subjectInput.value = 'Welcome {{name}}!';
    subjectInput.dispatchEvent(new Event('input'));
    bodyTextarea.value = '<p>Hi {{name}}, welcome onboard!</p>';
    bodyTextarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="template-save-button"]').click();
    fixture.detectChanges();

    const createReq = http.expectOne('/projects/p-1/templates');
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual({
      name: 'Welcome Email',
      subject: 'Welcome {{name}}!',
      bodyHtml: '<p>Hi {{name}}, welcome onboard!</p>',
    });

    createReq.flush({
      message: 'Created',
      data: {
        id: 'tpl-2',
        projectId: 'p-1',
        name: 'Welcome Email',
        subject: 'Welcome {{name}}!',
        bodyHtml: '<p>Hi {{name}}, welcome onboard!</p>',
      },
      success: true,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Welcome Email');
  });

  it('edits a template and sends PATCH /projects/:projectId/templates/:id', () => {
    const fixture = TestBed.createComponent(TemplatesPage);
    fixture.detectChanges();

    http.expectOne('/projects/p-1/templates?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [mockTemplate], metadata: { page: 1, limit: 20, total: 1 }, success: true });
    fixture.detectChanges();

    chooseTemplateAction(fixture, 'Edit');

    const nameInput = fixture.nativeElement.querySelector('[data-testid="template-name-input"]') as HTMLInputElement;
    expect(nameInput.value).toBe('Monthly Payroll');

    nameInput.value = 'Updated Payroll';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="template-save-button"]').click();
    fixture.detectChanges();

    const patchReq = http.expectOne('/projects/p-1/templates/tpl-1');
    expect(patchReq.request.method).toBe('PATCH');
    expect(patchReq.request.body).toEqual({
      name: 'Updated Payroll',
      subject: 'Your Payslip for {{period}}',
      bodyHtml: '<p>Dear {{name}},</p><p>Your pay is {{amount}}.</p>',
    });

    patchReq.flush({
      message: 'Updated',
      data: { ...mockTemplate, name: 'Updated Payroll' },
      success: true,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Updated Payroll');
  });

  it('opens a read-only template detail drawer from row actions', () => {
    const fixture = TestBed.createComponent(TemplatesPage);
    fixture.detectChanges();
    http.expectOne('/projects/p-1/templates?page=1&limit=20&sortBy=createdAt&sortDir=desc')
      .flush({ message: 'ok', data: [mockTemplate], metadata: { page: 1, limit: 20, total: 1 }, success: true });
    fixture.detectChanges();

    chooseTemplateAction(fixture, 'Detail');
    expect(fixture.nativeElement.textContent).toContain('Email template details');
    expect(fixture.nativeElement.textContent).toContain('Your Payslip for {{period}}');
    expect(fixture.nativeElement.textContent).toContain('<p>Dear {{name}},</p><p>Your pay is {{amount}}.</p>');
  });

  it('deletes a template after confirmation', () => {
    const fixture = TestBed.createComponent(TemplatesPage);
    fixture.detectChanges();

    http.expectOne('/projects/p-1/templates?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [mockTemplate], metadata: { page: 1, limit: 20, total: 1 }, success: true });
    fixture.detectChanges();

    chooseTemplateAction(fixture, 'Delete');

    expect(fixture.nativeElement.textContent).toContain('Delete Monthly Payroll?');

    fixture.nativeElement.querySelector('[data-testid="confirm-delete-tpl-1"]').click();
    fixture.detectChanges();

    const delReq = http.expectOne('/projects/p-1/templates/tpl-1');
    expect(delReq.request.method).toBe('DELETE');
    delReq.flush({ message: 'Deleted', data: null, success: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="template-card-tpl-1"]')).toBeNull();
  });

  it('detects client-side unsafe template syntax such as {{#if}} or {{{x}}} and disables submit', () => {
    const fixture = TestBed.createComponent(TemplatesPage);
    fixture.detectChanges();

    http.expectOne('/projects/p-1/templates?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [mockTemplate], metadata: { page: 1, limit: 20, total: 1 }, success: true });
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="add-template-button"]').click();
    fixture.detectChanges();

    const bodyTextarea = fixture.nativeElement.querySelector('[data-testid="template-body-textarea"]') as HTMLTextAreaElement;
    bodyTextarea.value = '<p>{{#if bonus}}Bonus: {{bonus}}{{/if}}</p>';
    bodyTextarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Unsupported placeholder syntax');
    expect(fixture.nativeElement.textContent).toContain('Only simple {{field_name}} is supported');

    const submitBtn = fixture.nativeElement.querySelector('[data-testid="template-save-button"]') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it('displays API UNSAFE_TEMPLATE error when server rejects unsafe syntax', () => {
    const fixture = TestBed.createComponent(TemplatesPage);
    fixture.detectChanges();

    http.expectOne('/projects/p-1/templates?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [mockTemplate], metadata: { page: 1, limit: 20, total: 1 }, success: true });
    fixture.detectChanges();

    chooseTemplateAction(fixture, 'Edit');

    // Trigger save
    fixture.nativeElement.querySelector('[data-testid="template-save-button"]').click();
    fixture.detectChanges();

    const patchReq = http.expectOne('/projects/p-1/templates/tpl-1');
    patchReq.flush(
      { error: { code: 'UNSAFE_TEMPLATE', message: 'Template contains unsafe placeholder syntax' } },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Template contains unsafe placeholder syntax');
  });

  it('live preview pane renders sandboxed iframe and escapes sample placeholder values', () => {
    const fixture = TestBed.createComponent(TemplatesPage);
    fixture.detectChanges();

    http.expectOne('/projects/p-1/templates?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [mockTemplate], metadata: { page: 1, limit: 20, total: 1 }, success: true });
    fixture.detectChanges();

    chooseTemplateAction(fixture, 'Edit');

    const iframe = fixture.nativeElement.querySelector('[data-testid="template-preview-iframe"]') as HTMLIFrameElement;
    expect(iframe).not.toBeNull();
    expect(iframe.getAttribute('sandbox')).toBe('');

    const srcdoc = iframe.getAttribute('srcdoc');
    expect(srcdoc).toContain('[Sample name]');
    expect(srcdoc).toContain('[Sample amount]');
    // Check HTML escaping in preview
    expect(srcdoc).not.toContain('<script>');
  });
});
