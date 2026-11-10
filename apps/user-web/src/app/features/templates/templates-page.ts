import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPlus } from '@ng-icons/tabler-icons';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { HlmAlert, HlmAlertDescription, HlmAlertTitle } from '../../ui/alert/src';
import { HlmBadge } from '../../ui/badge/src';
import { HlmButton } from '../../ui/button/src';
import { ConfirmModal, DataTableControls, Drawer, ListBody, PageHeader, Pagination, RowActions, type RowActionItem, SelectControl } from '../../ui';
import { type EmailTemplate, TemplatesService } from './templates.service';
import { Ripple } from '../../ui/shared/ripple';

@Component({
  selector: 'app-templates-page',
  imports: [Ripple, CommonModule, NgIcon, SelectControl, HlmButton, HlmAlert, HlmAlertTitle, HlmAlertDescription, DataTableControls, ListBody, PageHeader, RowActions, Drawer, ConfirmModal, Pagination],
  providers: [provideIcons({ tablerPlus })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-list-layout">
      <app-page-header title="Email Templates" description="Manage personalized email templates and placeholder bindings." [topLevel]="false">
        <button page-actions hlmBtn type="button" class="max-md:hidden" data-testid="add-template-button" (click)="openAddForm()"><ng-icon name="tablerPlus" aria-hidden="true" class="size-[1.1rem]" />New template</button><app-row-actions page-actions class="md:hidden" [solid]="true" label="Page actions" [items]="pageActions" (actionSelect)="openAddForm()" />
      </app-page-header>
      @if (actionError()) { <div aria-live="polite" role="alert"><div hlmAlert variant="destructive"><h2 hlmAlertTitle>Error</h2><p hlmAlertDescription>{{ actionError() }}</p></div></div> }
      @if (actionSuccess()) { <div aria-live="polite" role="status"><div hlmAlert class="border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"><h2 hlmAlertTitle>Success</h2><p hlmAlertDescription>{{ actionSuccess() }}</p></div></div> }
      <app-data-table-controls [query]="listQuery()" searchPlaceholder="Search templates..." (queryChange)="searchTemplates($event)"><div table-filters><label class="grid min-w-40 gap-1 text-xs font-medium text-muted-foreground">Sort templates<select appSelect aria-label="Sort templates" class="h-control-9 rounded-ui-md border border-input bg-background px-3 text-sm" [value]="sortBy()" (change)="sortTemplates($event)"><option value="createdAt">Created</option><option value="updatedAt">Updated</option><option value="name">Name</option><option value="subject">Subject</option></select></label></div></app-data-table-controls>
      <app-list-body [state]="listState()" [itemCount]="templates().length" [query]="listQuery()" errorTitle="Failed to load email templates" [errorMessage]="loadError() ?? ''" emptyTitle="No templates yet" emptyMessage="Create an email template to start sending personalized emails." emptyResultLabel="No templates match" (retry)="loadTemplates()" (clearQuery)="searchTemplates('')">
        <div list-content class="overflow-x-auto rounded-ui-lg border border-border" aria-label="Email templates">
          <table data-responsive aria-label="Email templates list" class="w-full min-w-[42rem] border-collapse text-left text-sm">
            <thead class="bg-muted/50 text-xs text-muted-foreground"><tr><th scope="col" class="px-4 py-3 font-medium">Template name</th><th scope="col" class="px-4 py-3 font-medium">Subject</th><th scope="col" class="px-4 py-3 font-medium">Last updated</th><th scope="col" class="px-4 py-3 text-right font-medium">Actions</th></tr></thead>
            <tbody class="divide-y divide-border">
              @for (template of templates(); track template.id) {
                <tr [attr.data-testid]="'template-row-' + template.id" class="hover:bg-muted/30">
                  <th data-label="Template name" scope="row" class="px-4 py-3 font-medium text-foreground">{{ template.name }}</th><td data-label="Subject" class="max-w-md truncate px-4 py-3 text-muted-foreground">{{ template.subject }}</td><td data-label="Last updated" class="px-4 py-3 text-muted-foreground tabular-nums">{{ (template.updatedAt || template.createdAt) | date: 'mediumDate' }}</td>
                  <td data-label="Actions" class="px-4 py-2 text-right"><app-row-actions [attr.data-testid]="'template-actions-' + template.id" [label]="'Actions for ' + template.name" [items]="templateActions" (actionSelect)="handleTemplateAction($event, template)" /></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <button empty-action hlmBtn class="mt-4" type="button" data-testid="empty-add-template-button" (click)="openAddForm()">Create your first template</button>
      </app-list-body>
      <app-pagination [metadata]="listMetadata()" (pageChange)="changeListPage($event)" />
      <app-drawer [open]="detailTemplate() !== null" title="Email template details" (closed)="detailTemplate.set(null)">
        @if (detailTemplate(); as template) { <dl class="space-y-4"><div><dt class="text-xs font-medium text-muted-foreground">Name</dt><dd class="mt-1 font-medium">{{ template.name }}</dd></div><div><dt class="text-xs font-medium text-muted-foreground">Subject</dt><dd class="mt-1">{{ template.subject }}</dd></div><div><dt class="text-xs font-medium text-muted-foreground">HTML body</dt><dd class="mt-1 whitespace-pre-wrap break-words rounded-ui-md bg-muted p-3 font-mono text-xs">{{ template.bodyHtml }}</dd></div></dl> }
      </app-drawer>
    </div>
    <app-confirm-modal
      [open]="pendingDelete() !== null"
      [title]="'Delete ' + (pendingDelete()?.name ?? 'this item') + '?'"
      message="This will permanently remove this email template."
      confirmLabel="Delete template"
      [confirmTestId]="'confirm-delete-' + (pendingDelete()?.id ?? '')"
      (cancelled)="confirmingDeleteId.set(null)"
      (confirmed)="pendingDelete() && deleteTemplate(pendingDelete()!.id)"
    />
  `,
})
export class TemplatesPage implements OnInit {
  private readonly service = inject(TemplatesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  projectId = '';
  readonly templates = signal<EmailTemplate[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly listQuery = signal('');
  readonly listMetadata = signal({ page: 1, limit: 20, total: 0 });
  readonly sortBy = signal<'name' | 'subject' | 'createdAt' | 'updatedAt'>('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly detailTemplate = signal<EmailTemplate | null>(null);
  readonly listState = computed(() => this.loading() ? 'loading' as const : this.loadError() ? 'error' as const : 'ready' as const);
  readonly templateActions: RowActionItem[] = [{ id: 'detail', label: 'Detail', icon: 'eye' }, { id: 'edit', label: 'Edit', icon: 'pencil' }, { id: 'delete', label: 'Delete', icon: 'trash', destructive: true }];
  protected readonly pageActions: RowActionItem[] = [{ id: 'new', label: 'New template', icon: 'plus' }];
  readonly confirmingDeleteId = signal<string | null>(null);
  protected readonly pendingDelete = computed(() => this.templates().find((template) => template.id === this.confirmingDeleteId()) ?? null);
  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = signal<string | null>(null);

  ngOnInit(): void { this.projectId = this.resolveProjectId(); this.loadTemplates(); }
  private resolveProjectId(): string { let current: ActivatedRoute | null = this.route; while (current) { const id = current.snapshot.paramMap.get('projectId'); if (id) return id; current = current.parent; } return ''; }

  loadTemplates(): void {
    if (!this.projectId) return;
    this.loading.set(true); this.loadError.set(null);
    this.service.list(this.projectId, this.listMetadata().page, 20, this.listQuery(), this.sortBy(), this.sortDir()).subscribe({
      next: (response) => { this.templates.set(response.data); this.listMetadata.set(response.metadata); this.loading.set(false); },
      error: (error: unknown) => { this.loading.set(false); this.loadError.set(error instanceof ApiError ? error.message : 'Could not load templates'); },
    });
  }
  searchTemplates(query: string): void { this.listQuery.set(query); this.listMetadata.update((value) => ({ ...value, page: 1 })); this.loadTemplates(); }
  changeListPage(page: number): void { this.listMetadata.update((value) => ({ ...value, page })); this.loadTemplates(); }
  sortTemplates(event: Event): void { this.sortBy.set((event.currentTarget as HTMLSelectElement).value as 'name' | 'subject' | 'createdAt' | 'updatedAt'); this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc'); this.listMetadata.update((value) => ({ ...value, page: 1 })); this.loadTemplates(); }
  openAddForm(): void { void this.router.navigate(['/projects', this.projectId, 'templates', 'new']); }
  openEditForm(template: EmailTemplate): void { void this.router.navigate(['/projects', this.projectId, 'templates', template.id]); }
  handleTemplateAction(action: RowActionItem, template: EmailTemplate): void { if (action.id === 'detail') this.detailTemplate.set(template); else if (action.id === 'edit') this.openEditForm(template); else if (action.id === 'delete') this.confirmingDeleteId.set(template.id); }
  deleteTemplate(id: string): void {
    this.actionError.set(null); this.actionSuccess.set(null);
    this.service.delete(this.projectId, id).subscribe({
      next: () => { this.confirmingDeleteId.set(null); this.templates.update((items) => items.filter((template) => template.id !== id)); this.listMetadata.update((value) => ({ ...value, total: Math.max(0, value.total - 1) })); this.actionSuccess.set('Template deleted successfully'); },
      error: (error: unknown) => { this.confirmingDeleteId.set(null); this.actionError.set(error instanceof ApiError ? error.message : 'Failed to delete template'); },
    });
  }
}
