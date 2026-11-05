import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type CreatePdfTemplatePayload,
  type PdfTemplateItem,
  PdfTemplatesService,
} from './pdf-templates.service';

const mockTemplate: PdfTemplateItem = {
  id: 'tpl-1',
  projectId: 'proj-1',
  name: 'Receipt Template',
  nodeTree: {
    page: { size: 'A4', margin: 20 },
    nodes: [],
  },
  createdAt: '2026-11-08T12:00:00.000Z',
  updatedAt: '2026-11-08T12:00:00.000Z',
};

describe('PdfTemplatesService', () => {
  let service: PdfTemplatesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), PdfTemplatesService],
    });
    service = TestBed.inject(PdfTemplatesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists templates for a project', () => {
    let result: { data: PdfTemplateItem[]; metadata: { page: number; limit: number; total: number } } | undefined;
    service.listTemplates('proj-1').subscribe((res) => (result = res));

    const req = http.expectOne('/projects/proj-1/pdf-templates?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    expect(req.request.method).toBe('GET');
    req.flush({ message: 'ok', data: [mockTemplate], metadata: { page: 1, limit: 20, total: 1 }, success: true });

    expect(result).toEqual({ data: [mockTemplate], metadata: { page: 1, limit: 20, total: 1 } });
  });

  it('gets a template by id', () => {
    let result: PdfTemplateItem | undefined;
    service.getTemplate('proj-1', 'tpl-1').subscribe((res) => (result = res));

    const req = http.expectOne('/projects/proj-1/pdf-templates/tpl-1');
    expect(req.request.method).toBe('GET');
    req.flush({ message: 'ok', data: mockTemplate, success: true });

    expect(result).toEqual(mockTemplate);
  });

  it('creates a template', () => {
    const payload: CreatePdfTemplatePayload = {
      name: 'Receipt Template',
      nodeTree: { page: { size: 'A4', margin: 20 }, nodes: [] },
    };

    let result: PdfTemplateItem | undefined;
    service.createTemplate('proj-1', payload).subscribe((res) => (result = res));

    const req = http.expectOne('/projects/proj-1/pdf-templates');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ message: 'ok', data: mockTemplate, success: true });

    expect(result).toEqual(mockTemplate);
  });

  it('updates a template', () => {
    let result: PdfTemplateItem | undefined;
    service
      .updateTemplate('proj-1', 'tpl-1', { name: 'Updated Receipt' })
      .subscribe((res) => (result = res));

    const req = http.expectOne('/projects/proj-1/pdf-templates/tpl-1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Updated Receipt' });
    req.flush({ message: 'ok', data: { ...mockTemplate, name: 'Updated Receipt' }, success: true });

    expect(result?.name).toBe('Updated Receipt');
  });

  it('deletes a template', () => {
    let completed = false;
    service.deleteTemplate('proj-1', 'tpl-1').subscribe(() => (completed = true));

    const req = http.expectOne('/projects/proj-1/pdf-templates/tpl-1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'ok', data: null, success: true });

    expect(completed).toBe(true);
  });

  it('lists attachments for image nodes', () => {
    let attachments: unknown;
    service.listAttachments('proj-1').subscribe((res) => (attachments = res));

    const req = http.expectOne('/projects/proj-1/attachments');
    expect(req.request.method).toBe('GET');
    req.flush({
      message: 'ok',
      data: [{ id: 'att-1', projectId: 'proj-1', fileName: 'logo.png', sizeBytes: '1024', kind: 'image/png', createdAt: '2026-11-08' }],
      success: true,
    });

    expect(attachments).toEqual([
      { id: 'att-1', projectId: 'proj-1', fileName: 'logo.png', sizeBytes: '1024', kind: 'image/png', createdAt: '2026-11-08' },
    ]);
  });

  it('lists uploads and previews latest upload columns for placeholders', () => {
    let uploads: unknown;
    service.listUploads('proj-1').subscribe((res) => (uploads = res));

    const req1 = http.expectOne('/projects/proj-1/uploads');
    req1.flush({
      message: 'ok',
      data: [{ id: 'up-1', projectId: 'proj-1', fileName: 'customers.csv', rowCount: 10, columns: ['first_name'], createdAt: '2026-11-08' }],
      success: true,
    });
    expect(uploads).toHaveLength(1);

    let preview: unknown;
    service.getUploadPreview('proj-1', 'up-1').subscribe((res) => (preview = res));

    const req2 = http.expectOne('/projects/proj-1/uploads/up-1');
    req2.flush({
      message: 'ok',
      data: {
        id: 'up-1',
        projectId: 'proj-1',
        fileName: 'customers.csv',
        rowCount: 10,
        columns: ['first_name', 'email', 'amount'],
        preview: [{ first_name: 'John', email: 'john@example.com', amount: '100' }],
        createdAt: '2026-11-08',
      },
      success: true,
    });
    expect(preview).toBeDefined();
  });
});
