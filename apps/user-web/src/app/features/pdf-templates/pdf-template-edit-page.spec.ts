import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PdfTemplateEditPage } from './pdf-template-edit-page';
import type { PdfTemplateItem } from './pdf-templates.service';

const mockExistingTemplate: PdfTemplateItem = {
  id: 'tpl-1',
  projectId: 'proj-1',
  name: 'Existing Invoice',
  nodeTree: {
    page: { size: 'A4', margin: 20 },
    nodes: [
      {
        id: 'node-1',
        type: 'text',
        x: 10,
        y: 10,
        width: 150,
        height: 30,
        content: 'Invoice for {{client_name}}',
        style: { fontSize: 14, bold: true, align: 'left', color: '#111827' },
      },
    ],
  },
  createdAt: '2026-11-08T10:00:00.000Z',
  updatedAt: '2026-11-08T10:00:00.000Z',
};

describe('PdfTemplateEditPage (Integrated with Real PdfBuilderEditor)', () => {
  let http: HttpTestingController;
  let router: Router;

  describe('Create New Template Mode (/pdf-templates/new)', () => {
    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [PdfTemplateEditPage],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: {
                paramMap: {
                  get: (k: string) => {
                    if (k === 'projectId') return 'proj-1';
                    if (k === 'templateId') return null;
                    return null;
                  },
                },
              },
              parent: {
                snapshot: {
                  paramMap: {
                    get: (k: string) => (k === 'projectId' ? 'proj-1' : null),
                  },
                },
              },
            },
          },
        ],
      });
      http = TestBed.inject(HttpTestingController);
      router = TestBed.inject(Router);
    });

    afterEach(() => http.verify());

    it('loads placeholders from latest upload preview and attachments list', () => {
      const fixture = TestBed.createComponent(PdfTemplateEditPage);
      fixture.detectChanges();

      const reqUploads = http.expectOne('/projects/proj-1/uploads');
      reqUploads.flush({
        message: 'ok',
        data: [{ id: 'up-1', projectId: 'proj-1', fileName: 'data.csv', rowCount: 5, columns: ['client_name', 'total_due'], createdAt: '' }],
        success: true,
      });

      const reqPreview = http.expectOne('/projects/proj-1/uploads/up-1');
      reqPreview.flush({
        message: 'ok',
        data: {
          id: 'up-1',
          projectId: 'proj-1',
          fileName: 'data.csv',
          rowCount: 5,
          columns: ['client_name', 'total_due'],
          preview: [{ client_name: 'Acme Corp', total_due: '$500' }],
          createdAt: '',
        },
        success: true,
      });

      const reqAtt = http.expectOne('/projects/proj-1/attachments');
      reqAtt.flush({
        message: 'ok',
        data: [{ id: 'att-1', projectId: 'proj-1', fileName: 'logo.png', sizeBytes: '100', kind: 'image/png', createdAt: '' }],
        success: true,
      });

      fixture.detectChanges();
      expect(fixture.componentInstance.placeholders()).toEqual(['client_name', 'total_due']);
      expect(fixture.componentInstance.attachments().length).toBe(1);
      expect(fixture.nativeElement.querySelector('app-back-button')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('New PDF Template');
      expect(fixture.nativeElement.querySelector('[data-page-badge]')).toBeNull();
    });

    it('adding a text node then saving sends the exact POST body with nodes', () => {
      vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const fixture = TestBed.createComponent(PdfTemplateEditPage);
      fixture.detectChanges();

      http.expectOne('/projects/proj-1/uploads').flush({ message: 'ok', data: [], success: true });
      http.expectOne('/projects/proj-1/attachments').flush({ message: 'ok', data: [], success: true });
      fixture.detectChanges();

      // Click "Add element -> Text" in the real editor sidebar
      const addTextBtn = fixture.nativeElement.querySelector('[data-testid="add-text-node"]');
      expect(addTextBtn).not.toBeNull();
      addTextBtn.click();
      fixture.detectChanges();

      // Check that editor has 2 nodes now (default node-title-1 + new text node)
      const editor = fixture.componentInstance.editorComponent();
      expect(editor).toBeDefined();
      expect(editor?.editor.nodes().length).toBe(2);

      // Save template
      const saveBtn = fixture.nativeElement.querySelector('[data-testid="save-template-button"]');
      saveBtn.click();
      fixture.detectChanges();

      const postReq = http.expectOne('/projects/proj-1/pdf-templates');
      expect(postReq.request.method).toBe('POST');
      expect(postReq.request.body).toEqual({
        name: 'New Template',
        nodeTree: {
          page: { size: 'A4', margin: 20 },
          nodes: editor?.editor.nodes(),
        },
      });

      postReq.flush({
        message: 'ok',
        data: {
          ...mockExistingTemplate,
          name: 'New Template',
          nodeTree: {
            page: { size: 'A4', margin: 20 },
            nodes: editor?.editor.nodes() ?? [],
          },
        },
        success: true,
      });
      fixture.detectChanges();

      expect(fixture.componentInstance.isDirty()).toBe(false);
      expect(fixture.componentInstance.saveSuccessMessage()).toContain('New Template');
    });

    it('invalid nodes block save and display errors', () => {
      const fixture = TestBed.createComponent(PdfTemplateEditPage);
      fixture.detectChanges();

      http.expectOne('/projects/proj-1/uploads').flush({ message: 'ok', data: [], success: true });
      http.expectOne('/projects/proj-1/attachments').flush({ message: 'ok', data: [], success: true });
      fixture.detectChanges();

      const editor = fixture.componentInstance.editorComponent()!;
      expect(editor).toBeDefined();

      // Move or update node to be invalid: x + width > 595
      const currentNodes = editor.editor.nodes();
      editor.editor.updateNode(currentNodes[0].id, { x: 500, width: 200 });
      fixture.detectChanges();

      const saveBtn = fixture.nativeElement.querySelector('[data-testid="save-template-button"]');
      saveBtn.click();
      fixture.detectChanges();

      http.expectNone('/projects/proj-1/pdf-templates');

      const errorsSection = fixture.nativeElement.querySelector('[data-testid="validation-errors-section"]');
      expect(errorsSection).not.toBeNull();
      expect(errorsSection.textContent).toContain('exceeds page width');
    });

    it('selecting a node shows its properties in the panel and a patch changes the preview', () => {
      const fixture = TestBed.createComponent(PdfTemplateEditPage);
      fixture.detectChanges();

      http.expectOne('/projects/proj-1/uploads').flush({ message: 'ok', data: [], success: true });
      http.expectOne('/projects/proj-1/attachments').flush({ message: 'ok', data: [], success: true });
      fixture.detectChanges();

      const editor = fixture.componentInstance.editorComponent()!;
      const firstNode = editor.editor.nodes()[0];
      expect(firstNode.type).toBe('text');
      if (firstNode.type !== 'text') return;

      // Select first node
      editor.editor.selectedId.set(firstNode.id);
      fixture.detectChanges();

      // Check that properties panel shows firstNode content
      const panel = fixture.nativeElement.querySelector('[data-testid="node-properties-panel"]');
      expect(panel).not.toBeNull();
      const contentTextarea = fixture.nativeElement.querySelector('[data-testid="text-content"]');
      expect(contentTextarea).not.toBeNull();
      expect(contentTextarea.value).toBe(firstNode.content);

      // Edit content in panel
      contentTextarea.value = 'Updated via Properties Panel';
      contentTextarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      // Assert editor state updated
      const updatedNode = editor.editor.nodes()[0];
      expect(updatedNode.type).toBe('text');
      if (updatedNode.type === 'text') {
        expect(updatedNode.content).toBe('Updated via Properties Panel');
      }

      // Assert preview in canvas updated
      const previewText = fixture.nativeElement.querySelector('.preview-text');
      expect(previewText.textContent).toContain('Updated via Properties Panel');
    });
  });

  describe('Edit Existing Template Mode (/pdf-templates/:templateId)', () => {
    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [PdfTemplateEditPage],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: {
                paramMap: {
                  get: (k: string) => {
                    if (k === 'projectId') return 'proj-1';
                    if (k === 'templateId') return 'tpl-1';
                    return null;
                  },
                },
              },
              parent: {
                snapshot: {
                  paramMap: {
                    get: (k: string) => (k === 'projectId' ? 'proj-1' : null),
                  },
                },
              },
            },
          },
        ],
      });
      http = TestBed.inject(HttpTestingController);
      router = TestBed.inject(Router);
    });

    afterEach(() => http.verify());

    it('loads existing template, allows saving PATCH, and handles API errors like UNSAFE_TEMPLATE', () => {
      const fixture = TestBed.createComponent(PdfTemplateEditPage);
      fixture.detectChanges();

      const tReq = http.expectOne('/projects/proj-1/pdf-templates/tpl-1');
      tReq.flush({ message: 'ok', data: mockExistingTemplate, success: true });

      http.expectOne('/projects/proj-1/uploads').flush({ message: 'ok', data: [], success: true });
      http.expectOne('/projects/proj-1/attachments').flush({ message: 'ok', data: [], success: true });
      fixture.detectChanges();

      expect(fixture.componentInstance.name()).toBe('Existing Invoice');

      // Save
      const saveBtn = fixture.nativeElement.querySelector('[data-testid="save-template-button"]');
      saveBtn.click();
      fixture.detectChanges();

      const patchReq = http.expectOne('/projects/proj-1/pdf-templates/tpl-1');
      expect(patchReq.request.method).toBe('PATCH');
      patchReq.flush(
        { error: { code: 'UNSAFE_TEMPLATE', message: 'Unsafe template content detected' } },
        { status: 400, statusText: 'Bad Request' },
      );
      fixture.detectChanges();

      const apiErr = fixture.nativeElement.querySelector('[data-testid="api-error-alert"]');
      expect(apiErr).not.toBeNull();
      expect(apiErr.textContent).toContain('Unsafe template content detected');
    });

    it('canDeactivate blocks navigation when dirty and user cancels confirm', () => {
      const fixture = TestBed.createComponent(PdfTemplateEditPage);
      fixture.detectChanges();

      http.expectOne('/projects/proj-1/pdf-templates/tpl-1').flush({ message: 'ok', data: mockExistingTemplate, success: true });
      http.expectOne('/projects/proj-1/uploads').flush({ message: 'ok', data: [], success: true });
      http.expectOne('/projects/proj-1/attachments').flush({ message: 'ok', data: [], success: true });
      fixture.detectChanges();

      expect(fixture.componentInstance.canDeactivate()).toBe(true);

      fixture.componentInstance.isDirty.set(true);
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      expect(fixture.componentInstance.canDeactivate()).toBe(false);

      confirmSpy.mockReturnValue(true);
      expect(fixture.componentInstance.canDeactivate()).toBe(true);
    });
  });
});
