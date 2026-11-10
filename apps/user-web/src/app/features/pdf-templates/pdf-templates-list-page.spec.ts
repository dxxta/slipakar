import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PdfTemplatesListPage } from './pdf-templates-list-page';
import type { PdfTemplateItem } from './pdf-templates.service';

const mockTemplates: PdfTemplateItem[] = [
  {
    id: 'tpl-1',
    projectId: 'proj-1',
    name: 'Standard Invoice',
    nodeTree: {
      page: { size: 'A4', margin: 20 },
      nodes: [
        {
          id: 'n1',
          type: 'text',
          x: 10,
          y: 10,
          width: 200,
          height: 30,
          content: 'Invoice',
          style: { fontSize: 16, bold: true, align: 'left', color: '#000000' },
        },
      ],
    },
    createdAt: '2026-11-08T10:00:00.000Z',
    updatedAt: '2026-11-08T12:00:00.000Z',
  },
];

describe('PdfTemplatesListPage', () => {
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PdfTemplatesListPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: (k: string) => (k === 'projectId' ? 'proj-1' : null) } },
            parent: {
              snapshot: { paramMap: { get: (k: string) => (k === 'projectId' ? 'proj-1' : null) } },
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  function chooseTemplateAction(fixture: ComponentFixture<PdfTemplatesListPage>, label: string): void {
    const trigger = fixture.nativeElement.querySelector('[data-testid="pdf-template-actions-tpl-1"] button') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    const action = [...(fixture.nativeElement as HTMLElement).querySelectorAll('[role="menuitem"]')]
      .find((item) => item.textContent?.trim() === label) as HTMLButtonElement | undefined;
    if (!action) throw new Error(`Could not find PDF template action ${label}`);
    action.click();
    fixture.detectChanges();
  }

  it('renders loading skeleton initially while templates are fetching', () => {
    const fixture = TestBed.createComponent(PdfTemplatesListPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-page-header')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-data-table-controls')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-list-body [data-list-state="loading"]')).not.toBeNull();

    const skeleton = fixture.nativeElement.querySelector('app-list-body [data-list-state="loading"]');
    expect(skeleton).not.toBeNull();

    const req = http.expectOne('/projects/proj-1/pdf-templates?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    expect(req.request.method).toBe('GET');
    req.flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-list-body [data-list-state="loading"]')).toBeNull();
  });

  it('keeps PDF template filters mounted for a search-empty result', () => {
    const fixture = TestBed.createComponent(PdfTemplatesListPage);
    fixture.detectChanges();
    http.expectOne('/projects/proj-1/pdf-templates?page=1&limit=20&sortBy=createdAt&sortDir=desc')
      .flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();

    fixture.componentInstance.search('no matching template');
    fixture.detectChanges();
    http.expectOne('/projects/proj-1/pdf-templates?page=1&limit=20&sortBy=createdAt&sortDir=desc&q=no+matching+template')
      .flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-data-table-controls')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-list-state="search-empty"]')?.textContent).toContain('no matching template');
  });

  it('renders templates list with name, node count, updated date, and edit link', () => {
    const fixture = TestBed.createComponent(PdfTemplatesListPage);
    fixture.detectChanges();

    const req = http.expectOne('/projects/proj-1/pdf-templates?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    req.flush({ message: 'ok', data: mockTemplates, metadata: { page: 1, limit: 20, total: mockTemplates.length }, success: true });
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('[data-testid="template-row-tpl-1"]');
    expect(row).not.toBeNull();
    expect(row.textContent).toContain('Standard Invoice');
    expect(row.textContent).toContain('1 node');
    expect(row.querySelector('[data-testid="pdf-template-actions-tpl-1"]')).not.toBeNull();
  });

  it('renders empty state with call to action when no templates exist', () => {
    const fixture = TestBed.createComponent(PdfTemplatesListPage);
    fixture.detectChanges();

    const req = http.expectOne('/projects/proj-1/pdf-templates?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    req.flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();

    const empty = fixture.nativeElement.querySelector('[data-list-state="empty"]');
    expect(empty).not.toBeNull();
    expect(empty.textContent).toContain('No PDF templates yet');
    expect(fixture.nativeElement.querySelector('[data-testid="empty-create-button"]')).not.toBeNull();
  });

  it('renders feature disabled card when GET returns 404', () => {
    const fixture = TestBed.createComponent(PdfTemplatesListPage);
    fixture.detectChanges();

    const req = http.expectOne('/projects/proj-1/pdf-templates?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    req.flush(
      { error: { code: 'NOT_FOUND', message: 'PDF builder feature is disabled' } },
      { status: 404, statusText: 'Not Found' },
    );
    fixture.detectChanges();

    const disabledCard = fixture.nativeElement.querySelector('[data-testid="feature-disabled-card"]');
    expect(disabledCard).not.toBeNull();
    expect(disabledCard.textContent).toContain('PDF Builder is disabled');
    expect(disabledCard.textContent).toContain('administrator');
    expect(disabledCard.textContent).toContain('feature flag');
  });

  it('renders error state with retry on 500 failure and recovers', () => {
    const fixture = TestBed.createComponent(PdfTemplatesListPage);
    fixture.detectChanges();

    const req1 = http.expectOne('/projects/proj-1/pdf-templates?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    req1.flush(
      { error: { message: 'Database failure' } },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();

    const errorAlert = fixture.nativeElement.querySelector('[data-list-state="error"]');
    expect(errorAlert).not.toBeNull();

    const retryBtn = errorAlert.querySelector('button');
    expect(retryBtn).not.toBeNull();
    retryBtn.click();
    fixture.detectChanges();

    const req2 = http.expectOne('/projects/proj-1/pdf-templates?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    req2.flush({ message: 'ok', data: mockTemplates, metadata: { page: 1, limit: 20, total: mockTemplates.length }, success: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-list-state="error"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="template-row-tpl-1"]')).not.toBeNull();
  });

  it('supports delete with confirm dialog', () => {
    const fixture = TestBed.createComponent(PdfTemplatesListPage);
    fixture.detectChanges();

    const req1 = http.expectOne('/projects/proj-1/pdf-templates?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    req1.flush({ message: 'ok', data: [...mockTemplates], metadata: { page: 1, limit: 20, total: mockTemplates.length }, success: true });
    fixture.detectChanges();

    chooseTemplateAction(fixture, 'Delete');

    const confirmBtn = fixture.nativeElement.querySelector('[data-testid="confirm-delete-tpl-1"]');
    expect(confirmBtn).not.toBeNull();
    confirmBtn.click();
    fixture.detectChanges();

    const delReq = http.expectOne('/projects/proj-1/pdf-templates/tpl-1');
    expect(delReq.request.method).toBe('DELETE');
    delReq.flush({ message: 'ok', data: null, success: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="template-row-tpl-1"]')).toBeNull();
  });

  it('keeps PDF template row actions focused on editing and deleting', () => {
    const fixture = TestBed.createComponent(PdfTemplatesListPage);
    fixture.detectChanges();
    http.expectOne('/projects/proj-1/pdf-templates?page=1&limit=20&sortBy=createdAt&sortDir=desc')
      .flush({ message: 'ok', data: mockTemplates, metadata: { page: 1, limit: 20, total: 1 }, success: true });
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="pdf-template-actions-tpl-1"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const labels = [...(fixture.nativeElement as HTMLElement).querySelectorAll('[role="menuitem"]')].map((item) => item.textContent?.trim());
    expect(labels).toContain('Edit');
    expect(labels).toContain('Delete');
    expect(labels).not.toContain('Detail');
  });
});
