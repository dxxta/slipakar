import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { HlmBadge } from '../../ui/badge/src';
import { HlmButton } from '../../ui/button/src';
import { Drawer } from '../../ui/shared/drawer';
import { BackButton } from '../../ui/shared/back-button';
import { PdfBuilderEditor } from '../pdf-builder/pdf-builder-editor';
import {
  type PdfNode,
  type PdfNodeTree,
  type PdfNodeValidationError,
  validateNodes,
} from '../pdf-builder/pdf-node.types';
import { PdfNodePropertiesComponent } from './pdf-node-properties.component';
import {
  type AttachmentItem,
  type CreatePdfTemplatePayload,
  PdfTemplatesService,
} from './pdf-templates.service';

@Component({
  selector: 'app-pdf-template-edit-page',
  imports: [
    CommonModule,
    FormsModule,
    HlmButton,
    HlmBadge,
    BackButton,
    PdfNodePropertiesComponent,
    PdfBuilderEditor,
    Drawer,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-list-layout">
      <header class="flex flex-wrap items-start gap-3 border-b border-border pb-4">
        <app-back-button [link]="['/projects', projectId(), 'pdf-templates']" label="Back to PDF templates" />
        <div class="min-w-0 flex-1"><h1 class="text-3xl font-semibold tracking-tight">{{ isNew() ? 'New PDF Template' : 'Edit PDF Template' }}</h1><p class="mt-2 text-sm text-muted-foreground">Configure visual nodes, bindings, and layout for this PDF template.</p></div>
        <div class="ml-auto flex flex-wrap items-center justify-end gap-2">@if (isDirty()) { <span hlmBadge variant="outline" class="text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs">Unsaved changes</span> }<button hlmBtn variant="outline" type="button" data-testid="cancel-button" (click)="onCancel()">Cancel</button><button hlmBtn type="button" data-testid="save-template-button" [disabled]="saving()" (click)="save()">{{ saving() ? 'Saving…' : 'Save template' }}</button></div>
      </header>

      <!-- Feedback Alerts: Success or API Error -->
      @if (saveSuccessMessage()) {
        <div
          data-testid="save-success-alert"
          role="status"
          class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300"
        >
          {{ saveSuccessMessage() }}
        </div>
      }

      @if (apiError()) {
        <div
          data-testid="api-error-alert"
          role="alert"
          class="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="font-semibold">Unable to save template</p>
              <p class="mt-0.5 text-xs text-muted-foreground">{{ apiError() }}</p>
            </div>
            <button
              type="button"
              class="text-xs hover:underline text-destructive"
              (click)="apiError.set(null)"
            >
              Dismiss
            </button>
          </div>
        </div>
      }

      <!-- Validation Errors Alert Section -->
      @if (validationErrors().length > 0) {
        <div
          data-testid="validation-errors-section"
          role="alert"
          class="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <p class="font-semibold">
            Validation failed ({{ validationErrors().length }} {{ validationErrors().length === 1 ? 'error' : 'errors' }}). Please correct the following issues before saving:
          </p>
          <ul class="mt-2 list-disc pl-5 space-y-1 text-xs">
            @for (err of validationErrors(); track err.nodeId + err.field + err.message) {
              <li>
                @if (err.nodeId) {
                  <button
                    type="button"
                    class="font-mono underline hover:text-foreground font-medium"
                    (click)="selectNodeById(err.nodeId)"
                  >
                    [{{ err.nodeId }}]
                  </button>
                  <span class="font-medium"> {{ err.field }}:</span>
                } @else {
                  <span class="font-medium">{{ err.field }}:</span>
                }
                {{ err.message }}
              </li>
            }
          </ul>
        </div>
      }

      <section aria-label="Template name" class="flex items-center justify-between gap-3 rounded-ui-lg border border-border bg-card p-card">
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Template name</p>
          <p class="mt-1 truncate text-lg font-semibold">{{ name() || 'Untitled template' }}</p>
        </div>
        <button hlmBtn variant="outline" type="button" class="shrink-0" (click)="nameDrawerOpen.set(true)">Edit template name</button>
      </section>
      <app-drawer [open]="nameDrawerOpen()" title="Template details" (closed)="nameDrawerOpen.set(false)">
        <form class="space-y-4" (submit)="$event.preventDefault(); nameDrawerOpen.set(false)">
          <label for="template-name" class="block text-sm font-medium">Template Name</label>
          <input id="template-name" data-testid="template-name-input" type="text" required maxlength="100" class="h-control-9 w-full rounded-ui-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="e.g. Monthly Tax Invoice" [ngModel]="name()" [ngModelOptions]="{standalone: true}" (ngModelChange)="onNameChange($event)" />
          <button hlmBtn type="submit">Done</button>
        </form>
      </app-drawer>

      <!-- Editor Canvas Area hosting <app-pdf-builder-editor> with projected [panel] -->
      @if (loading()) {
        <div
          data-testid="editor-loading"
          role="status"
          aria-busy="true"
          class="h-96 rounded-lg border border-border bg-muted/20 flex items-center justify-center text-muted-foreground text-sm"
        >
          Loading template details...
        </div>
      } @else {
        <section aria-label="PDF Builder Editor">
          <app-pdf-builder-editor
            #editorComponent
            [nodes]="nodes()"
            [placeholders]="placeholders()"
            (nodesChange)="onNodesChange($event)"
            (valid)="onEditorValidChange($event)"
          >
            <div panel>
              @if (selectedNode(); as selNode) {
                <app-pdf-node-properties
                  [node]="selNode"
                  [errors]="validationErrors()"
                  [placeholders]="placeholders()"
                  [attachments]="attachments()"
                  [uploadingImage]="uploadingImage()"
                  [uploadError]="uploadError()"
                  (imageUpload)="onImageUpload($event)"
                  (patch)="onNodePatch($event)"
                  (delete)="onNodeDelete($event)"
                  (duplicate)="onNodeDuplicate($event)"
                />
              } @else {
                <div class="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground" data-testid="no-node-selected">
                  <p class="font-medium">No node selected</p>
                  <p class="mt-1 text-xs">Click on any node in the canvas to inspect and edit its properties.</p>
                </div>
              }
            </div>
          </app-pdf-builder-editor>
        </section>
      }
    </div>
  `,
})
export class PdfTemplateEditPage implements OnInit {
  private readonly service = inject(PdfTemplatesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly editorComponent = viewChild<PdfBuilderEditor>('editorComponent');

  readonly name = signal('New Template');
  readonly nameDrawerOpen = signal(true);
  readonly nodes = signal<PdfNode[]>([]);
  readonly placeholders = signal<string[]>([]);
  readonly attachments = signal<AttachmentItem[]>([]);
  readonly uploadingImage = signal(false);
  readonly uploadError = signal<string | null>(null);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly isDirty = signal(false);
  readonly validationErrors = signal<PdfNodeValidationError[]>([]);
  readonly apiError = signal<string | null>(null);
  readonly saveSuccessMessage = signal<string | null>(null);

  get projectId(): () => string {
    return () =>
      this.route.snapshot.paramMap.get('projectId') ??
      this.route.parent?.snapshot.paramMap.get('projectId') ??
      '';
  }

  get templateId(): () => string | null {
    return () => this.route.snapshot.paramMap.get('templateId');
  }

  readonly isNew = computed(() => !this.templateId());

  readonly selectedNode = computed<PdfNode | null>(() => {
    const editor = this.editorComponent();
    if (!editor) {
      return this.nodes()[0] ?? null;
    }
    const selectedId = editor.editor.selectedId();
    if (!selectedId) {
      return editor.editor.nodes()[0] ?? this.nodes()[0] ?? null;
    }
    return editor.editor.nodes().find((n) => n.id === selectedId) ?? null;
  });

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isDirty()) {
      event.preventDefault();
    }
  }

  canDeactivate(): boolean {
    if (!this.isDirty()) return true;
    return window.confirm('You have unsaved changes. Are you sure you want to leave this page?');
  }

  ngOnInit(): void {
    this.init();
  }

  init(): void {
    const pid = this.projectId();
    if (!pid) return;

    this.loading.set(true);
    this.loadProjectPlaceholdersAndAttachments(pid);

    const tid = this.templateId();
    if (tid) {
      this.service.getTemplate(pid, tid).subscribe({
        next: (tpl) => {
          this.name.set(tpl.name);
          const loadedNodes = tpl.nodeTree?.nodes ?? [];
          this.nodes.set(loadedNodes);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.apiError.set(err instanceof Error ? err.message : 'Could not load template');
        },
      });
    } else {
      // New template default: 1 initial sample text node
      const defaultTextNode: PdfNode = {
        id: 'node-title-1',
        type: 'text',
        x: 40,
        y: 40,
        width: 300,
        height: 40,
        content: 'Document Title',
        style: { fontSize: 20, bold: true, align: 'left', color: '#111827' },
      };
      this.nodes.set([defaultTextNode]);
      this.loading.set(false);
    }
  }

  private loadProjectPlaceholdersAndAttachments(pid: string): void {
    this.service.listUploads(pid).subscribe({
      next: (uploads) => {
        if (uploads.length > 0) {
          const latest = uploads[0];
          this.service.getUploadPreview(pid, latest.id).subscribe({
            next: (preview) => {
              if (preview?.columns) {
                this.placeholders.set(preview.columns);
              }
            },
            error: () => {
              this.placeholders.set([]);
            },
          });
        }
      },
      error: () => {
        this.placeholders.set([]);
      },
    });

    this.service.listAttachments(pid).subscribe({
      next: (atts) => {
        this.attachments.set(atts);
      },
      error: () => {
        this.attachments.set([]);
      },
    });
  }

  onNameChange(newName: string): void {
    this.name.set(newName);
    this.isDirty.set(true);
  }

  onNodesChange(nodeTree: PdfNodeTree): void {
    this.nodes.set(nodeTree.nodes);
    this.isDirty.set(true);
    if (this.validationErrors().length > 0) {
      this.validateAllNodes();
    }
  }

  onEditorValidChange(_valid: boolean): void {
    if (this.validationErrors().length > 0) {
      this.validateAllNodes();
    }
  }

  selectNodeById(id: string): void {
    const editor = this.editorComponent();
    if (editor) {
      editor.editor.selectedId.set(id);
    }
  }

  onImageUpload(file: File): void {
    const pid = this.projectId();
    if (!pid) return;
    this.uploadingImage.set(true);
    this.uploadError.set(null);
    this.service.uploadAttachment(pid, file).subscribe({
      next: (attachment) => {
        this.uploadingImage.set(false);
        this.attachments.update((items) => [attachment, ...items]);
        this.onNodePatch({ attachmentId: attachment.id } as Partial<PdfNode>);
      },
      error: (error: unknown) => {
        this.uploadingImage.set(false);
        this.uploadError.set(error instanceof Error ? error.message : 'Image upload failed');
      },
    });
  }

  onNodePatch(patch: Partial<PdfNode>): void {
    const editor = this.editorComponent();
    const current = this.selectedNode();
    if (!current) return;

    if (editor) {
      editor.editor.updateNode(current.id, patch);
      this.nodes.set(editor.editor.nodes());
    } else {
      const updated = this.nodes().map((n) => (n.id === current.id ? ({ ...n, ...patch } as PdfNode) : n));
      this.nodes.set(updated);
    }

    this.isDirty.set(true);
    if (this.validationErrors().length > 0) {
      this.validateAllNodes();
    }
  }

  onNodeDelete(id: string): void {
    const editor = this.editorComponent();
    if (editor) {
      editor.editor.deleteNode(id);
      this.nodes.set(editor.editor.nodes());
    } else {
      const updated = this.nodes().filter((n) => n.id !== id);
      this.nodes.set(updated);
    }

    this.isDirty.set(true);
    if (this.validationErrors().length > 0) {
      this.validateAllNodes();
    }
  }

  onNodeDuplicate(id: string): void {
    const editor = this.editorComponent();
    if (editor) {
      const dup = editor.editor.duplicateNode(id);
      this.nodes.set(editor.editor.nodes());
      if (dup) {
        editor.editor.selectedId.set(dup.id);
      }
    } else {
      const original = this.nodes().find((n) => n.id === id);
      if (!original) return;
      const newId = `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const copy = {
        ...structuredClone(original),
        id: newId,
        x: Math.min(original.x + 16, 500),
        y: Math.min(original.y + 16, 750),
      };
      this.nodes.set([...this.nodes(), copy as PdfNode]);
    }

    this.isDirty.set(true);
    if (this.validationErrors().length > 0) {
      this.validateAllNodes();
    }
  }

  getCurrentNodes(): PdfNode[] {
    const editor = this.editorComponent();
    return editor ? editor.editor.nodes() : this.nodes();
  }

  private validateAllNodes(): boolean {
    const errors = validateNodes(this.getCurrentNodes());
    this.validationErrors.set(errors);
    return errors.length === 0;
  }

  save(): void {
    this.apiError.set(null);
    this.saveSuccessMessage.set(null);

    const name = this.name().trim();
    if (!name) {
      this.validationErrors.set([
        { nodeId: '', field: 'name', message: 'Template name is required' },
      ]);
      return;
    }

    if (!this.validateAllNodes()) {
      return;
    }

    const currentNodes = this.getCurrentNodes();
    const pid = this.projectId();
    const payload: CreatePdfTemplatePayload = {
      name,
      nodeTree: {
        page: { size: 'A4', margin: 20 },
        nodes: currentNodes,
      },
    };

    this.saving.set(true);
    const tid = this.templateId();

    if (tid) {
      this.service.updateTemplate(pid, tid, payload).subscribe({
        next: (saved) => {
          this.saving.set(false);
          this.isDirty.set(false);
          this.saveSuccessMessage.set(`Template "${saved.name}" saved successfully.`);
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.handleApiError(err);
        },
      });
    } else {
      this.service.createTemplate(pid, payload).subscribe({
        next: (created) => {
          this.saving.set(false);
          this.isDirty.set(false);
          this.saveSuccessMessage.set(`Template "${created.name}" created successfully.`);
          void this.router.navigate(['/projects', pid, 'pdf-templates', created.id]);
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.handleApiError(err);
        },
      });
    }
  }

  private handleApiError(err: unknown): void {
    if (err instanceof ApiError) {
      this.apiError.set(err.message || `Server error (${err.code})`);
    } else if (err instanceof Error) {
      this.apiError.set(err.message);
    } else {
      this.apiError.set('An unexpected error occurred while saving the template.');
    }
  }

  onCancel(): void {
    if (this.canDeactivate()) {
      void this.router.navigate(['/projects', this.projectId(), 'pdf-templates']);
    }
  }
}
