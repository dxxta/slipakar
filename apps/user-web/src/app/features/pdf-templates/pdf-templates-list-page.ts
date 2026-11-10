import { CommonModule } from '@angular/common';
import { SelectControl } from '../../ui/shared/select-control';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle } from '@ng-icons/tabler-icons';
import { ApiError } from '../../core/api-error';
import { HlmButton } from '../../ui/button/src';
import { DataTableControls } from '../../ui/shared/data-table-controls';
import { ListBody } from '../../ui/shared/list-body';
import { PageHeader } from '../../ui/shared/page-header';
import { RowActions, type RowActionItem } from '../../ui/shared/row-actions';
import { ConfirmModal } from '../../ui/shared/confirm-modal';
import { Drawer } from '../../ui/shared/drawer';
import { HlmBadge } from '../../ui/badge/src';
import type { PageMetadata } from '../../core/api-client';
import { type PdfTemplateItem, PdfTemplatesService } from './pdf-templates.service';
import { Pagination } from '../../ui/shared/pagination';

@Component({
  selector: 'app-pdf-templates-list-page',
  imports: [
    SelectControl, CommonModule, HlmButton, HlmBadge, DataTableControls, ListBody, PageHeader, RowActions, ConfirmModal, Drawer, Pagination, NgIcon],
  providers: [provideIcons({ tablerAlertTriangle })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-list-layout">
      <app-page-header title="PDF Templates" description="Design pixel-perfect PDF attachments and documents using the visual builder." [topLevel]="false">
        @if (!featureDisabled()) {
          <button
            page-actions
            hlmBtn
            type="button"
            data-testid="create-template-button"
            (click)="navigateToCreate()"
          >
            New template
          </button>
        }
      </app-page-header>

      @if (featureDisabled()) {
        <div data-testid="feature-disabled-card" role="status" class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-6 text-card-foreground">
          <div class="flex items-start gap-4">
            <div class="rounded-full bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300" aria-hidden="true">
              <ng-icon name="tablerAlertTriangle" class="size-6" />
            </div>
            <div class="space-y-1">
              <h3 class="text-base font-semibold">PDF Builder is disabled</h3>
              <p class="text-sm text-muted-foreground">The visual PDF template builder feature is currently turned off for this environment. An administrator can enable PDF builder in the admin web feature flags settings.</p>
            </div>
          </div>
        </div>
      } @else {
        <app-data-table-controls [query]="query()" searchPlaceholder="Search PDF templates..." (queryChange)="search($event)">
          <div table-filters>
            <label class="grid min-w-40 gap-1 text-xs font-medium text-muted-foreground">Sort PDF templates
              <select appSelect aria-label="Sort PDF templates" class="h-control-9 rounded-ui-md border border-input bg-background px-3 text-sm" [value]="sortBy()" (change)="sort($event)"><option value="createdAt">Created</option><option value="updatedAt">Updated</option><option value="name">Name</option></select>
            </label>
          </div>
        </app-data-table-controls>
        <app-list-body [state]="loading() ? 'loading' : error() ? 'error' : 'ready'" [itemCount]="templates().length" [query]="query()" errorTitle="Could not load PDF templates" [errorMessage]="error() ?? ''" emptyTitle="No PDF templates yet" emptyMessage="Create a custom layout with text, tables, images, and recipient placeholders." emptyResultLabel="No PDF templates match" (retry)="loadTemplates()" (clearQuery)="search('')">
          <div list-content class="overflow-x-auto rounded-lg border border-border bg-card">
            <table class="min-w-[38rem] w-full text-left text-sm" aria-label="PDF Templates list">
              <thead class="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase">
                <tr>
                  <th scope="col" class="px-6 py-3">Template Name</th>
                  <th scope="col" class="px-6 py-3">Node Count</th>
                  <th scope="col" class="px-6 py-3">Last Updated</th>
                  <th scope="col" class="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                @for (template of templates(); track template.id) {
                  <tr class="hover:bg-muted/50 transition-colors" [attr.data-testid]="'template-row-' + template.id">
                    <td class="px-6 py-4 font-medium">{{ template.name }}</td>
                    <td class="px-6 py-4 text-muted-foreground tabular-nums">{{ nodeCount(template) }} {{ nodeCount(template) === 1 ? 'node' : 'nodes' }}</td>
                    <td class="px-6 py-4 text-muted-foreground tabular-nums"><time [attr.datetime]="template.updatedAt" [attr.title]="template.updatedAt">{{ formatDate(template.updatedAt) }}</time></td>
                    <td class="px-6 py-4 text-right">
                      <app-row-actions [attr.data-testid]="'pdf-template-actions-' + template.id" [label]="'Actions for ' + template.name" [items]="templateActions" (actionSelect)="handleTemplateAction($event, template)" />
                      @if (confirmingDeleteId() === template.id) {
                        <app-confirm-modal [open]="true" [title]="'Delete ' + template.name + '?'" message="This action cannot be undone." confirmLabel="Delete template" [confirmTestId]="'confirm-delete-' + template.id" (cancelled)="confirmingDeleteId.set(null)" (confirmed)="deleteTemplate(template)" />
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <button empty-action hlmBtn class="mt-5" type="button" data-testid="empty-create-button" (click)="navigateToCreate()">Create your first PDF template</button>
        </app-list-body>
        <app-pagination [metadata]="metadata()" (pageChange)="setPage($event)" />
      }

      <app-drawer [open]="detailTemplate() !== null" title="PDF template details" (closed)="detailTemplate.set(null)">
        @if (detailTemplate(); as template) {
          <dl class="space-y-4">
            <div><dt class="text-xs font-medium text-muted-foreground">Name</dt><dd class="mt-1 font-medium">{{ template.name }}</dd></div>
            <div><dt class="text-xs font-medium text-muted-foreground">Elements</dt><dd class="mt-1">{{ nodeCount(template) }} {{ nodeCount(template) === 1 ? 'element' : 'elements' }}</dd></div>
            <div><dt class="text-xs font-medium text-muted-foreground">Last updated</dt><dd class="mt-1">{{ formatDate(template.updatedAt) }}</dd></div>
            <div>
              <dt class="text-xs font-medium text-muted-foreground">Layout elements</dt>
              <dd class="mt-2 flex flex-wrap gap-2">
                @for (node of template.nodeTree.nodes; track node.id) { <span hlmBadge variant="outline">{{ node.type }}</span> }
              </dd>
            </div>
          </dl>
        }
      </app-drawer>
    </div>
  `,
})
export class PdfTemplatesListPage implements OnInit {
  private readonly service = inject(PdfTemplatesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly templates = signal<PdfTemplateItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly featureDisabled = signal(false);
  readonly confirmingDeleteId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly detailTemplate = signal<PdfTemplateItem | null>(null);
  readonly query = signal('');
  readonly metadata = signal<PageMetadata>({ page: 1, limit: 20, total: 0 });
  readonly sortBy = signal<'name' | 'createdAt' | 'updatedAt'>('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly templateActions: RowActionItem[] = [
    { id: 'edit', label: 'Edit', icon: 'pencil' },
    { id: 'delete', label: 'Delete', icon: 'trash', destructive: true },
  ];

  get projectId(): () => string {
    return () =>
      this.route.snapshot.paramMap.get('projectId') ??
      this.route.parent?.snapshot.paramMap.get('projectId') ??
      '';
  }

  ngOnInit(): void {
    this.loadTemplates();
  }

  loadTemplates(): void {
    const pid = this.projectId();
    if (!pid) return;

    this.loading.set(true);
    this.error.set(null);
    this.featureDisabled.set(false);

    this.service.listTemplates(pid, this.metadata().page, 20, this.query(), this.sortBy(), this.sortDir()).subscribe({
      next: (response) => {
        this.templates.set(response.data);
        this.metadata.set(response.metadata);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        if (err instanceof ApiError && err.status === 404) {
          this.featureDisabled.set(true);
        } else {
          this.error.set(err instanceof Error ? err.message : 'Check your connection and try again.');
        }
      },
    });
  }

  search(query: string): void { this.query.set(query); this.metadata.update((value) => ({ ...value, page: 1 })); this.loadTemplates(); }
  setPage(page: number): void { this.metadata.update((value) => ({ ...value, page })); this.loadTemplates(); }
  sort(event: Event): void { this.sortBy.set((event.currentTarget as HTMLSelectElement).value as 'name' | 'createdAt' | 'updatedAt'); this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc'); this.metadata.update((value) => ({ ...value, page: 1 })); this.loadTemplates(); }

  nodeCount(template: PdfTemplateItem): number {
    return template.nodeTree?.nodes?.length ?? 0;
  }

  formatDate(isoString: string): string {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  navigateToCreate(): void {
    void this.router.navigate(['/projects', this.projectId(), 'pdf-templates', 'new']);
  }

  navigateToEdit(event: MouseEvent | null, id: string): void {
    if (event) event.preventDefault();
    void this.router.navigate(['/projects', this.projectId(), 'pdf-templates', id]);
  }

  handleTemplateAction(action: RowActionItem, template: PdfTemplateItem): void {
    if (action.id === 'detail') this.detailTemplate.set(template);
    else if (action.id === 'edit') this.navigateToEdit(null, template.id);
    else if (action.id === 'delete') this.confirmingDeleteId.set(template.id);
  }

  deleteTemplate(template: PdfTemplateItem): void {
    const pid = this.projectId();
    if (this.deletingId()) return;

    this.deletingId.set(template.id);
    this.service.deleteTemplate(pid, template.id).subscribe({
      next: () => {
        this.templates.update((list) => list.filter((t) => t.id !== template.id));
        this.metadata.update((m) => ({ ...m, total: Math.max(0, m.total - 1) }));
        this.confirmingDeleteId.set(null);
        this.deletingId.set(null);
      },
      error: (err: unknown) => {
        this.deletingId.set(null);
        this.error.set(err instanceof Error ? err.message : 'Could not delete template.');
      },
    });
  }
}
