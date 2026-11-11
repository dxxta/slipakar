import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EmbedSessionService } from '../../core/embed-session.service';
import { DataPage } from './data-page';
import type { UploadItem, UploadPreview } from './data.service';

const mockUpload: UploadItem = {
  id: 'up-1',
  projectId: 'p-1',
  fileName: 'recipients.csv',
  rowCount: 25,
  columns: ['fullName', 'email', 'salary'],
  createdAt: '2026-11-08T12:00:00.000Z',
};

const mockPreview: UploadPreview = {
  ...mockUpload,
  preview: [
    { fullName: 'Alice Johnson', email: 'alice@example.com', salary: '5000' },
    { fullName: 'Bob Smith', email: 'bob@example.com', salary: '6000' },
  ],
};

const mockTemplates = [
  {
    id: 'tpl-1',
    projectId: 'p-1',
    name: 'Payroll Notification',
    subject: 'Payslip for {{fullName}}',
    bodyHtml: '<p>Hi {{fullName}}, salary is {{salary}}.</p>',
  },
];

function chooseUploadAction(fixture: ComponentFixture<DataPage>, label: string): void {
  const trigger = fixture.nativeElement.querySelector('[data-testid="upload-actions-up-1"] button') as HTMLButtonElement;
  trigger.click();
  fixture.detectChanges();
  const action = [...(fixture.nativeElement as HTMLElement).querySelectorAll('[role="menuitem"]')]
    .find((item) => item.textContent?.trim() === label) as HTMLButtonElement | undefined;
  if (!action) throw new Error(`Could not find upload action ${label}`);
  action.click();
  fixture.detectChanges();
}

describe('DataPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DataPage],
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

  it('renders uploaded files list and loads preview for active upload', () => {
    const fixture = TestBed.createComponent(DataPage);
    fixture.detectChanges();

    // Initial requests: uploads list, templates list, pdf-templates list
    const uploadsReq = http.expectOne('/projects/p-1/uploads');
    expect(uploadsReq.request.method).toBe('GET');
    uploadsReq.flush({ message: 'ok', data: [mockUpload], success: true });

    const tplReq = http.expectOne('/projects/p-1/templates?page=1&limit=100&sortBy=createdAt&sortDir=desc');
    tplReq.flush({ message: 'ok', data: mockTemplates, metadata: { page: 1, limit: 100, total: mockTemplates.length }, success: true });

    const pdfReq = http.expectOne('/projects/p-1/pdf-templates?page=1&limit=100&sortBy=createdAt&sortDir=desc');
    pdfReq.flush({ message: 'ok', data: [], metadata: { page: 1, limit: 100, total: 0 }, success: true });

    // Since uploads has items, it selects the first one and loads its preview
    const previewReq = http.expectOne('/projects/p-1/uploads/up-1');
    previewReq.flush({ message: 'ok', data: mockPreview, success: true });

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-page-header')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-data-table-controls')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="mapping-card"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('recipients.csv');
    expect(fixture.nativeElement.textContent).toContain('Alice Johnson');
    expect(fixture.nativeElement.textContent).toContain('bob@example.com');
  });

  it('hides write controls when an embed session has read-only scopes', () => {
    const embed = TestBed.inject(EmbedSessionService);
    embed.enableMode();
    embed.session.set({
      token: `slpe_${'x'.repeat(43)}`,
      projectId: 'p-1',
      scopes: ['uploads:read', 'mappings:read', 'templates:read'],
      theme: null,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      parentOrigin: 'https://host.example',
    });
    embed.state.set('ready');

    const fixture = TestBed.createComponent(DataPage);
    fixture.detectChanges();
    http.expectOne('/projects/p-1/uploads').flush({ message: 'ok', data: [mockUpload], success: true });
    http.expectOne('/projects/p-1/templates?page=1&limit=100&sortBy=createdAt&sortDir=desc')
      .flush({ message: 'ok', data: mockTemplates, metadata: { page: 1, limit: 100, total: 1 }, success: true });
    http.expectOne('/projects/p-1/pdf-templates?page=1&limit=100&sortBy=createdAt&sortDir=desc')
      .flush({ message: 'ok', data: [], metadata: { page: 1, limit: 100, total: 0 }, success: true });
    http.expectOne('/projects/p-1/uploads/up-1').flush({ message: 'ok', data: mockPreview, success: true });
    fixture.componentInstance.selectedTemplateId.set('tpl-1');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="file-dropzone"]')).toBeNull();
    const actionsTrigger = fixture.nativeElement.querySelector('[data-testid="upload-actions-up-1"] button') as HTMLButtonElement;
    actionsTrigger.click();
    fixture.detectChanges();
    expect([...fixture.nativeElement.querySelectorAll('[role="menuitem"]')].map((item: Element) => item.textContent?.trim())).toEqual(['Detail']);
    expect(fixture.nativeElement.querySelector('[data-testid="auto-suggest-button"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="save-mapping-button"]')).toBeNull();
    expect((fixture.nativeElement.querySelector('[data-testid="mapping-select-fullName"]') as HTMLSelectElement).disabled).toBe(true);
  });

  it('keeps the upload filter mounted and shows a search-empty result', () => {
    const fixture = TestBed.createComponent(DataPage);
    fixture.detectChanges();
    http.expectOne('/projects/p-1/uploads').flush({ message: 'ok', data: [mockUpload], success: true });
    http.expectOne('/projects/p-1/templates?page=1&limit=100&sortBy=createdAt&sortDir=desc')
      .flush({ message: 'ok', data: mockTemplates, metadata: { page: 1, limit: 100, total: 1 }, success: true });
    http.expectOne('/projects/p-1/pdf-templates?page=1&limit=100&sortBy=createdAt&sortDir=desc')
      .flush({ message: 'ok', data: [], metadata: { page: 1, limit: 100, total: 0 }, success: true });
    http.expectOne('/projects/p-1/uploads/up-1').flush({ message: 'ok', data: mockPreview, success: true });
    fixture.detectChanges();

    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = 'missing-file';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-data-table-controls')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-list-state="search-empty"]')?.textContent).toContain('missing-file');
    (fixture.nativeElement.querySelector('[data-action="clear-search"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="upload-row-up-1"]')).not.toBeNull();
  });

  it('pages uploaded files and keeps exactly one active file selected', () => {
    const files = Array.from({ length: 6 }, (_, index) => ({ ...mockUpload, id: `up-${index + 1}`, fileName: `recipients-${index + 1}.csv` }));
    const fixture = TestBed.createComponent(DataPage);
    fixture.detectChanges();
    http.expectOne('/projects/p-1/uploads').flush({ message: 'ok', data: files, success: true });
    http.expectOne('/projects/p-1/templates?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [], metadata: { page: 1, limit: 100, total: 0 }, success: true });
    http.expectOne('/projects/p-1/pdf-templates?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [], metadata: { page: 1, limit: 100, total: 0 }, success: true });
    http.expectOne('/projects/p-1/uploads/up-1').flush({ message: 'ok', data: mockPreview, success: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[data-testid^="upload-row-"]')).toHaveLength(5);
    const secondCheckbox = fixture.nativeElement.querySelector('[aria-label="Select recipients-2.csv"]') as HTMLInputElement;
    secondCheckbox.checked = true;
    secondCheckbox.dispatchEvent(new Event('change'));
    http.expectOne('/projects/p-1/uploads/up-2').flush({ message: 'ok', data: { ...mockPreview, id: 'up-2' }, success: true });
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedUploadId()).toBe('up-2');

    const selectedCheckbox = fixture.nativeElement.querySelector('[aria-label="Select recipients-2.csv"]') as HTMLInputElement;
    selectedCheckbox.checked = false;
    selectedCheckbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('[aria-label="Select recipients-2.csv"]') as HTMLInputElement).checked).toBe(true);

    (fixture.nativeElement.querySelector('[aria-label="Next page"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-testid^="upload-row-"]')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('[data-testid="upload-row-up-6"]')).not.toBeNull();
  });

  it('uploads a file using FormData multipart POST and handles error if invalid', () => {
    const fixture = TestBed.createComponent(DataPage);
    fixture.detectChanges();

    http.expectOne('/projects/p-1/uploads').flush({ message: 'ok', data: [], metadata: { page: 1, limit: 100, total: 0 }, success: true });
    http.expectOne('/projects/p-1/templates?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [], metadata: { page: 1, limit: 100, total: 0 }, success: true });
    http.expectOne('/projects/p-1/pdf-templates?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [], metadata: { page: 1, limit: 100, total: 0 }, success: true });
    fixture.detectChanges();

    const fileInput = fixture.nativeElement.querySelector('[data-testid="file-input"]') as HTMLInputElement;
    const testFile = new File(['name,email\nTest,test@test.com'], 'test.csv', { type: 'text/csv' });

    Object.defineProperty(fileInput, 'files', {
      value: [testFile],
      writable: false,
    });
    fileInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const uploadReq = http.expectOne('/projects/p-1/uploads');
    expect(uploadReq.request.method).toBe('POST');
    expect(uploadReq.request.body instanceof FormData).toBe(true);

    uploadReq.flush(
      { error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Failed to parse CSV' } },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Failed to parse CSV');
  });

  it('deletes an uploaded file after confirmation', () => {
    const fixture = TestBed.createComponent(DataPage);
    fixture.detectChanges();

    http.expectOne('/projects/p-1/uploads').flush({ message: 'ok', data: [mockUpload], success: true });
    http.expectOne('/projects/p-1/templates?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: mockTemplates, metadata: { page: 1, limit: 100, total: mockTemplates.length }, success: true });
    http.expectOne('/projects/p-1/pdf-templates?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [], metadata: { page: 1, limit: 100, total: 0 }, success: true });
    http.expectOne('/projects/p-1/uploads/up-1').flush({ message: 'ok', data: mockPreview, success: true });
    fixture.detectChanges();

    chooseUploadAction(fixture, 'Delete');

    expect(fixture.nativeElement.textContent).toContain('Delete recipients.csv?');

    fixture.nativeElement.querySelector('[data-testid="confirm-delete-upload-up-1"]').click();
    fixture.detectChanges();

    const delReq = http.expectOne('/projects/p-1/uploads/up-1');
    expect(delReq.request.method).toBe('DELETE');
    delReq.flush({ message: 'ok', data: null, success: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="upload-row-up-1"]')).toBeNull();
  });

  it('opens a read-only uploaded file detail drawer from row actions', () => {
    const fixture = TestBed.createComponent(DataPage);
    fixture.detectChanges();
    http.expectOne('/projects/p-1/uploads').flush({ message: 'ok', data: [mockUpload], success: true });
    http.expectOne('/projects/p-1/templates?page=1&limit=100&sortBy=createdAt&sortDir=desc')
      .flush({ message: 'ok', data: mockTemplates, metadata: { page: 1, limit: 100, total: 1 }, success: true });
    http.expectOne('/projects/p-1/pdf-templates?page=1&limit=100&sortBy=createdAt&sortDir=desc')
      .flush({ message: 'ok', data: [], metadata: { page: 1, limit: 100, total: 0 }, success: true });
    http.expectOne('/projects/p-1/uploads/up-1').flush({ message: 'ok', data: mockPreview, success: true });
    fixture.detectChanges();

    chooseUploadAction(fixture, 'Detail');
    expect(fixture.nativeElement.textContent).toContain('Uploaded file details');
    expect(fixture.nativeElement.textContent).toContain('recipients.csv');
    expect(fixture.nativeElement.textContent).toContain('salary');
  });

  it('selects template, detects placeholders, auto-suggests mapping, blocks save when incomplete, and saves valid mapping', () => {
    const fixture = TestBed.createComponent(DataPage);
    fixture.detectChanges();

    http.expectOne('/projects/p-1/uploads').flush({ message: 'ok', data: [mockUpload], success: true });
    http.expectOne('/projects/p-1/templates?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: mockTemplates, metadata: { page: 1, limit: 100, total: mockTemplates.length }, success: true });
    http.expectOne('/projects/p-1/pdf-templates?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [], metadata: { page: 1, limit: 100, total: 0 }, success: true });
    http.expectOne('/projects/p-1/uploads/up-1').flush({ message: 'ok', data: mockPreview, success: true });
    fixture.detectChanges();

    fixture.detectChanges();
    // Select email template tpl-1
    const tplSelect = fixture.nativeElement.querySelector('[data-testid="template-select"]') as HTMLSelectElement;
    tplSelect.value = 'tpl-1';
    tplSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    // Check existing mapping request
    const getMapReq = http.expectOne('/projects/p-1/mappings?templateId=tpl-1&uploadId=up-1');
    getMapReq.flush({ error: { code: 'NOT_FOUND', message: 'No mapping' } }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    // Placeholders are {{fullName}} and {{salary}}
    expect(fixture.nativeElement.textContent).toContain('{{fullName}}');
    expect(fixture.nativeElement.textContent).toContain('{{salary}}');

    // Auto-suggest button triggers mapping matching columns
    fixture.nativeElement.querySelector('[data-testid="auto-suggest-button"]').click();
    fixture.detectChanges();

    // Salary and fullName should be auto-mapped because mockUpload.columns has fullName and salary
    const component = fixture.componentInstance;
    expect(component.currentMapping()['fullName']).toBe('fullName');
    expect(component.currentMapping()['salary']).toBe('salary');
    expect(component.recipientEmailColumn()).toBe('email');

    // Ready to save
    expect(component.isMappingComplete()).toBe(true);

    const saveBtn = fixture.nativeElement.querySelector('[data-testid="save-mapping-button"]') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);

    saveBtn.click();
    fixture.detectChanges();

    const saveReq = http.expectOne('/projects/p-1/mappings');
    expect(saveReq.request.method).toBe('PUT');
    expect(saveReq.request.body).toEqual({
      templateId: 'tpl-1',
      uploadId: 'up-1',
      mapping: {
        fullName: 'fullName',
        salary: 'salary',
      },
    });

    saveReq.flush({
      message: 'Mapping saved',
      data: {
        id: 'map-1',
        templateId: 'tpl-1',
        uploadId: 'up-1',
        mapping: { fullName: 'fullName', salary: 'salary' },
      },
      success: true,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Field mapping saved successfully');
    expect(fixture.nativeElement.querySelector('[data-testid="mapping-card"]')).not.toBeNull();
  });

  it('incomplete mapping disables save button and warns about unmapped placeholders', () => {
    const fixture = TestBed.createComponent(DataPage);
    fixture.detectChanges();

    http.expectOne('/projects/p-1/uploads').flush({ message: 'ok', data: [mockUpload], success: true });
    http.expectOne('/projects/p-1/templates?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: mockTemplates, metadata: { page: 1, limit: 100, total: mockTemplates.length }, success: true });
    http.expectOne('/projects/p-1/pdf-templates?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [], metadata: { page: 1, limit: 100, total: 0 }, success: true });
    http.expectOne('/projects/p-1/uploads/up-1').flush({ message: 'ok', data: mockPreview, success: true });
    fixture.detectChanges();

    fixture.detectChanges();
    const tplSelect = fixture.nativeElement.querySelector('[data-testid="template-select"]') as HTMLSelectElement;
    tplSelect.value = 'tpl-1';
    tplSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    http.expectOne('/projects/p-1/mappings?templateId=tpl-1&uploadId=up-1').flush({
      message: 'ok',
      data: { id: 'map-1', templateId: 'tpl-1', uploadId: 'up-1', mapping: { fullName: 'fullName' } }, // salary unmapped
      success: true,
    });
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.unmappedPlaceholders()).toEqual(['salary']);
    expect(component.isMappingComplete()).toBe(false);

    expect(fixture.nativeElement.textContent).toContain('Unmapped Placeholders (1)');
    expect(fixture.nativeElement.textContent).toContain('salary');

    const saveBtn = fixture.nativeElement.querySelector('[data-testid="save-mapping-button"]') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });
});
