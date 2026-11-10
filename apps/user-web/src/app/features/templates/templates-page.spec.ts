import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  let router: Router;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [TemplatesPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
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
    router = TestBed.inject(Router);
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
    expect(fixture.nativeElement.querySelector('table[aria-label="Email templates list"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="template-row-tpl-1"]')).not.toBeNull();
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

  it('routes New template to the dedicated template editor page', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(TemplatesPage);
    fixture.detectChanges();
    http.expectOne('/projects/p-1/templates?page=1&limit=20&sortBy=createdAt&sortDir=desc')
      .flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="add-template-button"]') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/projects', 'p-1', 'templates', 'new']);
  });

  it('routes Edit to the dedicated template editor page', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(TemplatesPage);
    fixture.detectChanges();
    http.expectOne('/projects/p-1/templates?page=1&limit=20&sortBy=createdAt&sortDir=desc')
      .flush({ message: 'ok', data: [mockTemplate], metadata: { page: 1, limit: 20, total: 1 }, success: true });
    fixture.detectChanges();

    chooseTemplateAction(fixture, 'Edit');
    expect(navigate).toHaveBeenCalledWith(['/projects', 'p-1', 'templates', 'tpl-1']);
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

    expect(fixture.nativeElement.querySelector('[data-testid="template-row-tpl-1"]')).toBeNull();
  });

});
