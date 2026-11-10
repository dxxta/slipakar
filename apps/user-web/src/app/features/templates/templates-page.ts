import { CommonModule } from '@angular/common';
import { SelectControl } from '../../ui/shared/select-control';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { PLACEHOLDER_REGEX } from '@lokaslip/shared';
import { ApiError } from '../../core/api-error';
import { HlmAlert, HlmAlertDescription, HlmAlertTitle } from '../../ui/alert/src';
import { DataTableControls } from '../../ui/shared/data-table-controls';
import { ListBody, type ListBodyState } from '../../ui/shared/list-body';
import { PageHeader } from '../../ui/shared/page-header';
import { RowActions, type RowActionItem } from '../../ui/shared/row-actions';
import { ConfirmModal, Drawer, Pagination } from '../../ui';
import { HlmBadge } from '../../ui/badge/src';
import { HlmButton } from '../../ui/button/src';
import { HlmCard, HlmCardContent, HlmCardDescription, HlmCardHeader, HlmCardTitle } from '../../ui/card/src';
import { type CreateTemplatePayload, type EmailTemplate, TemplatesService, type UpdateTemplatePayload } from './templates.service';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const escaped: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return escaped[character];
  });
}

function checkUnsafeSyntax(text: string): string | null {
  if (!text) return null;
  const regex = new RegExp(PLACEHOLDER_REGEX.source, PLACEHOLDER_REGEX.flags);
  const remainder = text.replace(regex, '');
  if (remainder.includes('{{') || remainder.includes('}}')) {
    return 'Template contains unsupported placeholder syntax (e.g. {{#if}}, {{> partial}}, {{{triple_stash}}}, or malformed braces). Only simple {{field_name}} is supported.';
  }
  return null;
}

function extractPlaceholders(text: string): string[] {
  if (!text) return [];
  const regex = new RegExp(PLACEHOLDER_REGEX.source, PLACEHOLDER_REGEX.flags);
  return [...new Set([...text.matchAll(regex)].map((m) => m[1]))];
}

@Component({
  selector: 'app-templates-page',
  imports: [
    SelectControl,
    CommonModule,
    HlmButton,
    HlmCard,
    HlmCardHeader,
    HlmCardTitle,
    HlmCardDescription,
    HlmCardContent,
    HlmBadge,
    HlmAlert,
    HlmAlertTitle,
    HlmAlertDescription,
    DataTableControls,
    ListBody,
    PageHeader,
    RowActions,
    Drawer,
    ConfirmModal,
    Pagination,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-list-layout">
      <app-page-header title="Email Templates" description="Manage personalized email templates and placeholder bindings." [topLevel]="false">
        @if (!showForm()) {
          <button page-actions hlmBtn type="button" data-testid="add-template-button" (click)="openAddForm()">
            New template
          </button>
        }
      </app-page-header>

      @if (actionError()) {
        <div aria-live="polite" role="alert">
          <div hlmAlert variant="destructive">
            <h4 hlmAlertTitle>Error</h4>
            <p hlmAlertDescription>{{ actionError() }}</p>
          </div>
        </div>
      }

      @if (actionSuccess()) {
        <div aria-live="polite" role="status">
          <div hlmAlert class="border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200">
            <h4 hlmAlertTitle class="text-emerald-800 dark:text-emerald-200">Success</h4>
            <p hlmAlertDescription class="text-emerald-700 dark:text-emerald-300">{{ actionSuccess() }}</p>
          </div>
        </div>
      }

      <!-- Form Mode with Editor and Live Preview -->
      @if (showForm()) {
        <app-drawer [open]="showForm()" [title]="editingId() ? 'Edit email template' : 'New email template'" (closed)="closeForm()">
        <div class="grid grid-cols-1 gap-6">
          <!-- Editor Form -->
          <div hlmCard data-testid="template-form-card">
            <div hlmCardHeader>
              <h3 hlmCardTitle>{{ editingId() ? 'Edit Template' : 'New Template' }}</h3>
              <p hlmCardDescription>Write HTML content with simple {{ '{{field_name}}' }} placeholders.</p>
            </div>
            <div hlmCardContent>
              <form class="space-y-4" (submit)="$event.preventDefault(); submitForm()">
                <div>
                  <label for="template-name" class="mb-1 block text-sm font-medium">Template name</label>
                  <input
                    id="template-name"
                    data-testid="template-name-input"
                    class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Monthly Payslip"
                    [value]="formName()"
                    (input)="formName.set($any($event.target).value)"
                    maxlength="100"
                    required
                  />
                </div>

                <div>
                  <label for="template-subject" class="mb-1 block text-sm font-medium">Subject line</label>
                  <input
                    id="template-subject"
                    data-testid="template-subject-input"
                    class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Your payslip for {{ '{{period}}' }}"
                    [value]="formSubject()"
                    (input)="formSubject.set($any($event.target).value)"
                    maxlength="300"
                    required
                  />
                </div>

                <div>
                  <div class="flex items-center justify-between">
                    <label for="template-body" class="mb-1 block text-sm font-medium">HTML body</label>
                    <span class="text-xs text-muted-foreground">HTML-escaped substitution</span>
                  </div>
                  <textarea
                    id="template-body"
                    data-testid="template-body-textarea"
                    rows="12"
                    class="font-mono text-xs w-full rounded-md border border-input bg-background p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring leading-relaxed"
                    placeholder="<p>Hello {{ '{{employee_name}}' }},</p><p>Please find attached...</p>"
                    [value]="formBody()"
                    (input)="formBody.set($any($event.target).value)"
                    required
                  ></textarea>
                  <p class="mt-1 text-xs text-muted-foreground">
                    Syntax: Use <code class="rounded bg-muted px-1 py-0.5">{{ '{{field_name}}' }}</code> for data replacement. Values are strictly HTML-escaped. Complex logic like blocks, loops, or triple braces is not supported.
                  </p>
                </div>

                @if (syntaxWarning()) {
                  <div aria-live="polite" role="alert">
                    <div hlmAlert variant="destructive">
                      <h4 hlmAlertTitle>Unsupported placeholder syntax</h4>
                      <p hlmAlertDescription>{{ syntaxWarning() }}</p>
                    </div>
                  </div>
                }

                <div class="flex items-center justify-end gap-2 pt-2">
                  <button hlmBtn variant="outline" type="button" (click)="closeForm()">
                    Cancel
                  </button>
                  <button
                    hlmBtn
                    type="submit"
                    data-testid="template-save-button"
                    [disabled]="isSaving() || !formName().trim() || !formSubject().trim() || !formBody().trim() || !!syntaxWarning()"
                  >
                    {{ isSaving() ? 'Saving…' : (editingId() ? 'Save changes' : 'Create template') }}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <!-- Live Preview Pane -->
          <div hlmCard data-testid="template-preview-card" class="flex flex-col">
            <div hlmCardHeader class="pb-3 border-b">
              <div class="flex items-center justify-between">
                <h3 hlmCardTitle class="text-base font-semibold">Live Preview</h3>
                <span hlmBadge variant="outline" class="text-xs">Sandboxed iframe</span>
              </div>
              <div class="mt-2 space-y-1 text-xs">
                <div>
                  <span class="text-muted-foreground font-medium">Subject:</span>
                  <span class="ml-1 font-semibold text-foreground">{{ renderedSubject() || '(Empty subject)' }}</span>
                </div>
                @if (detectedPlaceholders().length) {
                  <div class="flex flex-wrap items-center gap-1 pt-1">
                    <span class="text-muted-foreground">Detected placeholders:</span>
                    @for (p of detectedPlaceholders(); track p) {
                      <span class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {{ p }}
                      </span>
                    }
                  </div>
                }
              </div>
            </div>
            <div hlmCardContent class="flex-1 p-0">
              <iframe
                title="Email template preview"
                data-testid="template-preview-iframe"
                sandbox=""
                class="w-full h-[400px] border-0 rounded-b-xl bg-white text-black"
                [srcdoc]="sanitizedPreviewHtml()"
              ></iframe>
            </div>
          </div>
        </div>
        </app-drawer>
      }

      @if (!showForm()) {
        <app-data-table-controls [query]="listQuery()" searchPlaceholder="Search templates..." (queryChange)="searchTemplates($event)"><div table-filters><label class="grid min-w-40 gap-1 text-xs font-medium text-muted-foreground">Sort templates
          <select appSelect aria-label="Sort templates" class="h-control-9 rounded-ui-md border border-input bg-background px-3 text-sm" [value]="sortBy()" (change)="sortTemplates($event)"><option value="createdAt">Created</option><option value="updatedAt">Updated</option><option value="name">Name</option><option value="subject">Subject</option></select>
        </label></div></app-data-table-controls>
        <app-list-body [state]="listState()" [itemCount]="templates().length" [query]="listQuery()" errorTitle="Failed to load email templates" [errorMessage]="loadError() ?? ''" emptyTitle="No templates yet" emptyMessage="Create an email template to start sending personalized emails." emptyResultLabel="No templates match" (retry)="loadTemplates()" (clearQuery)="searchTemplates('')">
          <div list-content class="grid gap-4 sm:grid-cols-2" aria-label="Email templates">
            @for (tpl of templates(); track tpl.id) {
              <div hlmCard [attr.data-testid]="'template-card-' + tpl.id">
                <div hlmCardHeader class="pb-2">
                  <div class="flex items-start justify-between gap-3">
                    <h3 hlmCardTitle class="text-base font-semibold">{{ tpl.name }}</h3>
                    <app-row-actions [attr.data-testid]="'template-actions-' + tpl.id" [label]="'Actions for ' + tpl.name" [items]="templateActions" (actionSelect)="handleTemplateAction($event, tpl)" />
                  </div>
                  <p hlmCardDescription class="truncate">Subject: <span class="font-medium text-foreground">{{ tpl.subject }}</span></p>
                </div>
                <div hlmCardContent class="pt-2">
                  @if (confirmingDeleteId() === tpl.id) {
                    <app-confirm-modal [open]="true" [title]="'Delete ' + tpl.name + '?'" message="This action cannot be undone." confirmLabel="Delete template" [confirmTestId]="'confirm-delete-' + tpl.id" (cancelled)="confirmingDeleteId.set(null)" (confirmed)="deleteTemplate(tpl.id)" />
                  } @else {
                    <div class="line-clamp-3 rounded bg-muted/40 p-2 font-mono text-[11px] text-muted-foreground">{{ tpl.bodyHtml }}</div>
                  }
                </div>
              </div>
            }
          </div>
          <button empty-action hlmBtn class="mt-4" type="button" data-testid="empty-add-template-button" (click)="openAddForm()">Create your first template</button>
        </app-list-body>
        <app-pagination [metadata]="listMetadata()" (pageChange)="changeListPage($event)" />
      }

      <app-drawer [open]="detailTemplate() !== null" title="Email template details" (closed)="detailTemplate.set(null)">
        @if (detailTemplate(); as template) {
          <dl class="space-y-4">
            <div><dt class="text-xs font-medium text-muted-foreground">Name</dt><dd class="mt-1 font-medium">{{ template.name }}</dd></div>
            <div><dt class="text-xs font-medium text-muted-foreground">Subject</dt><dd class="mt-1">{{ template.subject }}</dd></div>
            <div><dt class="text-xs font-medium text-muted-foreground">HTML body</dt><dd class="mt-1 whitespace-pre-wrap break-words rounded-ui-md bg-muted p-3 font-mono text-xs">{{ template.bodyHtml }}</dd></div>
          </dl>
        }
      </app-drawer>
    </div>
  `,
})
export class TemplatesPage implements OnInit {
  private readonly templatesService = inject(TemplatesService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);

  projectId = '';

  readonly templates = signal<EmailTemplate[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly listQuery = signal('');
  readonly listMetadata = signal({ page: 1, limit: 20, total: 0 });
  readonly sortBy = signal<'name' | 'subject' | 'createdAt' | 'updatedAt'>('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly detailTemplate = signal<EmailTemplate | null>(null);
  readonly listState = computed<ListBodyState>(() => this.loading() ? 'loading' : this.loadError() ? 'error' : 'ready');
  readonly templateActions: RowActionItem[] = [
    { id: 'detail', label: 'Detail', icon: 'eye' },
    { id: 'edit', label: 'Edit', icon: 'pencil' },
    { id: 'delete', label: 'Delete', icon: 'trash', destructive: true },
  ];

  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly isSaving = signal(false);
  readonly isDeletingId = signal<string | null>(null);
  readonly confirmingDeleteId = signal<string | null>(null);

  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = signal<string | null>(null);

  // Form signals
  readonly formName = signal('');
  readonly formSubject = signal('');
  readonly formBody = signal('');

  // Computed syntax warning
  readonly syntaxWarning = computed(() => {
    const subjectWarning = checkUnsafeSyntax(this.formSubject());
    if (subjectWarning) return subjectWarning;
    const bodyWarning = checkUnsafeSyntax(this.formBody());
    return bodyWarning;
  });

  // Detected placeholders
  readonly detectedPlaceholders = computed(() => {
    const subjectNames = extractPlaceholders(this.formSubject());
    const bodyNames = extractPlaceholders(this.formBody());
    return [...new Set([...subjectNames, ...bodyNames])];
  });

  // Computed rendered preview
  readonly renderedSubject = computed(() => {
    const subject = this.formSubject();
    if (!subject) return '';
    const regex = new RegExp(PLACEHOLDER_REGEX.source, PLACEHOLDER_REGEX.flags);
    return subject.replace(regex, (_match, name: string) => `[${name}]`);
  });

  readonly previewHtml = computed(() => {
    const body = this.formBody();
    if (!body) return '<div style="font-family:sans-serif;color:#888;padding:20px;">No preview available</div>';
    const regex = new RegExp(PLACEHOLDER_REGEX.source, PLACEHOLDER_REGEX.flags);
    // Replace placeholders with sample escaped values
    const filled = body.replace(regex, (_match, name: string) => escapeHtml(`[Sample ${name}]`));
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,-apple-system,sans-serif;margin:16px;color:#111;}</style></head><body>${filled}</body></html>`;
  });

  readonly sanitizedPreviewHtml = computed<SafeHtml>(() => {
    return this.sanitizer.bypassSecurityTrustHtml(this.previewHtml());
  });

  ngOnInit(): void {
    this.projectId = this.resolveProjectId();
    if (this.projectId) {
      this.loadTemplates();
    }
  }

  private resolveProjectId(): string {
    let current: ActivatedRoute | null = this.route;
    while (current) {
      const pid = current.snapshot.paramMap.get('projectId');
      if (pid) return pid;
      current = current.parent;
    }
    return '';
  }

  loadTemplates(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.templatesService.list(this.projectId, this.listMetadata().page, 20, this.listQuery(), this.sortBy(), this.sortDir()).subscribe({
      next: (response) => {
        this.templates.set(response.data);
        this.listMetadata.set(response.metadata);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.loadError.set(err instanceof ApiError ? err.message : 'Could not load templates');
      },
    });
  }

  searchTemplates(query: string): void { this.listQuery.set(query); this.listMetadata.update((value) => ({ ...value, page: 1 })); this.loadTemplates(); }
  changeListPage(page: number): void { this.listMetadata.update((value) => ({ ...value, page })); this.loadTemplates(); }
  sortTemplates(event: Event): void { this.sortBy.set((event.currentTarget as HTMLSelectElement).value as 'name' | 'subject' | 'createdAt' | 'updatedAt'); this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc'); this.listMetadata.update((value) => ({ ...value, page: 1 })); this.loadTemplates(); }

  handleTemplateAction(action: RowActionItem, template: EmailTemplate): void {
    if (action.id === 'detail') this.detailTemplate.set(template);
    else if (action.id === 'edit') this.openEditForm(template);
    else if (action.id === 'delete') this.confirmingDeleteId.set(template.id);
  }

  openAddForm(): void {
    this.actionError.set(null);
    this.actionSuccess.set(null);
    this.editingId.set(null);
    this.formName.set('');
    this.formSubject.set('');
    this.formBody.set('');
    this.showForm.set(true);
  }

  openEditForm(tpl: EmailTemplate): void {
    this.actionError.set(null);
    this.actionSuccess.set(null);
    this.editingId.set(tpl.id);
    this.formName.set(tpl.name);
    this.formSubject.set(tpl.subject);
    this.formBody.set(tpl.bodyHtml);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  submitForm(): void {
    this.actionError.set(null);
    this.actionSuccess.set(null);
    const name = this.formName().trim();
    const subject = this.formSubject().trim();
    const bodyHtml = this.formBody().trim();

    if (!name || !subject || !bodyHtml || this.syntaxWarning()) return;

    this.isSaving.set(true);
    const id = this.editingId();

    if (id) {
      const payload: UpdateTemplatePayload = { name, subject, bodyHtml };
      this.templatesService.update(this.projectId, id, payload).subscribe({
        next: (updated) => {
          this.isSaving.set(false);
          this.templates.update((list) => list.map((t) => (t.id === id ? updated : t)));
          this.closeForm();
          this.actionSuccess.set('Template updated successfully');
        },
        error: (err: unknown) => {
          this.isSaving.set(false);
          const msg = err instanceof ApiError ? err.message : 'Failed to update template';
          this.actionError.set(msg);
        },
      });
    } else {
      const payload: CreateTemplatePayload = { name, subject, bodyHtml };
      this.templatesService.create(this.projectId, payload).subscribe({
        next: (created) => {
          this.isSaving.set(false);
          this.templates.update((list) => [...list, created]);
          this.listMetadata.update((m) => ({ ...m, total: m.total + 1 }));
          this.closeForm();
          this.actionSuccess.set('Template created successfully');
        },
        error: (err: unknown) => {
          this.isSaving.set(false);
          const msg = err instanceof ApiError ? err.message : 'Failed to create template';
          this.actionError.set(msg);
        },
      });
    }
  }

  deleteTemplate(id: string): void {
    this.actionError.set(null);
    this.actionSuccess.set(null);
    this.isDeletingId.set(id);
    this.templatesService.delete(this.projectId, id).subscribe({
      next: () => {
        this.isDeletingId.set(null);
        this.confirmingDeleteId.set(null);
        this.templates.update((list) => list.filter((t) => t.id !== id));
        this.listMetadata.update((m) => ({ ...m, total: Math.max(0, m.total - 1) }));
        this.actionSuccess.set('Template deleted successfully');
      },
      error: (err: unknown) => {
        this.isDeletingId.set(null);
        this.confirmingDeleteId.set(null);
        this.actionError.set(err instanceof ApiError ? err.message : 'Failed to delete template');
      },
    });
  }
}
