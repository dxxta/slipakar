import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiClient, type PageMetadata } from '../../core/api-client';
import { listQueryString, type ListQuery } from '../../core/list-query';
import { HlmButton } from '../../ui/button/src/lib/hlm-button';
import { SelectControl } from '../../ui/shared/select-control';
import {
  ConfirmModal,
  DataTableControls,
  Drawer,
  ListBody,
  PageHeader,
  Pagination,
  RowActions,
  type RowActionItem,
  SortHeader,
} from '../../ui';

type Project = {
  id: string;
  name: string;
  rateLimitPerMinute: number;
  maxUploadBytes: number;
  maxRows: number;
  storageQuotaBytes: string;
  createdAt?: string;
  updatedAt?: string;
};
type ProjectSort = 'name' | 'createdAt' | 'updatedAt';
type ProjectCounts = { campaigns: number; templates: number; uploads: number };

@Component({
  imports: [
    CommonModule,
    HlmButton,
    Drawer,
    ConfirmModal,
    DataTableControls,
    ListBody,
    PageHeader,
    Pagination,
    RowActions,
    SelectControl,
    SortHeader,
  ],
  selector: 'app-projects-page',
  template: `
    <app-page-header
      title="Projects"
      badge="Workspace"
      [topLevel]="true"
      description="Manage the workspaces that hold your data and campaigns."
    >
      <button hlmBtn type="button" page-actions class="max-md:hidden" data-action="new-project" (click)="openAddForm()">
        New project
      </button>
      <app-row-actions page-actions class="md:hidden" [solid]="true" label="Page actions" [items]="pageActions" (actionSelect)="openAddForm()" />
    </app-page-header>
    
    <br/>

    @if (mutationError()) {
      <p class="text-sm text-destructive" role="alert">{{ mutationError() }}</p>
    }

    <app-data-table-controls [query]="query()" searchPlaceholder="Search projects..." (queryChange)="onSearch($event)">
      <div table-filters class="flex items-end gap-3">
        <label class="grid min-w-40 gap-1 text-xs font-medium text-muted-foreground">
          Sort
          <select
            appSelect
            aria-label="Sort projects"
            class="h-control-9 rounded-ui-md border border-input bg-background px-3 text-sm"
            [value]="sortBy()"
            (change)="onSortSelect($event)"
          >
            <option value="createdAt">Created</option>
            <option value="updatedAt">Updated</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>
    </app-data-table-controls>

    <app-list-body
      [state]="listState()"
      [itemCount]="projects().length"
      [query]="query()"
      loadingLabel="Loading projects"
      errorTitle="Could not load projects"
      [errorMessage]="error() ?? 'Check your connection and try again.'"
      emptyTitle="No projects yet"
      emptyMessage="Create a project to start organizing your data."
      (retry)="loadProjects()"
      (clearQuery)="onSearch('')"
    >
      <div list-content class="space-y-4">
        <div class="overflow-x-auto rounded-ui-lg border border-border bg-card">
          <table class="w-full text-left text-sm" aria-label="Your projects">
            <thead class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-3" [attr.aria-sort]="ariaSort('name')">
                  <button appSortHeader="name" [sortBy]="sortBy()" [sortDir]="sortDir()" (sortChange)="onSort($event)">
                    Project
                  </button>
                </th>
                <th scope="col" class="px-4 py-3">Rows</th>
                <th scope="col" class="px-4 py-3" [attr.aria-sort]="ariaSort('updatedAt')">
                  <button appSortHeader="updatedAt" [sortBy]="sortBy()" [sortDir]="sortDir()" (sortChange)="onSort($event)">
                    Updated
                  </button>
                </th>
                <th scope="col" class="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              @for (project of projects(); track project.id) {
                <tr class="hover:bg-muted/40">
                  <td class="px-4 py-4">
                    <a
                      [href]="'/projects/' + project.id"
                      (click)="openProject($event, project.id)"
                      class="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {{ project.name }}
                    </a>
                    <p class="mt-1 text-xs text-muted-foreground">{{ project.rateLimitPerMinute }} requests/min</p>
                  </td>
                  <td class="px-4 py-4 text-muted-foreground">{{ project.maxRows.toLocaleString() }}</td>
                  <td class="px-4 py-4 text-muted-foreground">{{ project.updatedAt ? (project.updatedAt | date: 'mediumDate') : '—' }}</td>
                  <td class="px-4 py-4 text-right">
                    <div class="flex justify-end">
                      <app-row-actions
                        [label]="'Actions for ' + project.name"
                        [items]="projectActions"
                        [attr.data-action]="'actions-' + project.id"
                        (actionSelect)="handleProjectAction($event, project)"
                      />
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <div empty-action class="mt-5 flex justify-center">
        <button hlmBtn type="button" (click)="openAddForm()">Create your first project</button>
      </div>
    </app-list-body>
    <app-pagination [metadata]="metadata()" (pageChange)="onPageChange($event)" />

    <!-- Create / Edit Drawer -->
    <app-drawer [open]="formOpen()" [title]="editingProject() ? 'Rename project' : 'Create project'" (closed)="closeForm()">
      <form class="space-y-5" (submit)="$event.preventDefault(); saveProject()">
        <div class="grid gap-2">
          <label for="project-name" class="text-sm font-medium">Project name</label>
          <input
            id="project-name"
            class="h-control-9 rounded-ui-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Project name"
            [value]="formName()"
            (input)="onFormNameInput($event)"
            maxlength="100"
            required
            autofocus
          />
        </div>
        <div class="flex justify-end gap-2">
          <button hlmBtn variant="outline" type="button" (click)="closeForm()">Cancel</button>
          <button
            hlmBtn
            type="submit"
            data-action="save-project"
            [disabled]="saving() || !formName().trim()"
          >
            {{ saving() ? 'Saving…' : (editingProject() ? 'Save name' : 'Create project') }}
          </button>
        </div>
      </form>
    </app-drawer>

    <!-- Read-only Detail Drawer -->
    <app-drawer [open]="detailProject() !== null" [title]="detailProject()?.name ?? 'Project details'" (closed)="closeDetail()">
      @if (detailProject(); as project) {
        <dl class="space-y-4 text-sm">
          <div>
            <dt class="text-xs font-medium text-muted-foreground">Project name</dt>
            <dd class="mt-1 font-medium">{{ project.name }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-muted-foreground">Row limit</dt>
            <dd class="mt-1 font-medium">{{ project.maxRows.toLocaleString() }} rows</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-muted-foreground">Rate limit</dt>
            <dd class="mt-1 font-medium">{{ project.rateLimitPerMinute }} requests/min</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-muted-foreground">Created</dt>
            <dd class="mt-1">{{ project.createdAt ? (project.createdAt | date: 'medium') : '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-muted-foreground">Last updated</dt>
            <dd class="mt-1">{{ project.updatedAt ? (project.updatedAt | date: 'medium') : '—' }}</dd>
          </div>
          <div class="border-t border-border pt-3">
            <dt class="text-xs font-medium text-muted-foreground">Resource counts</dt>
            <dd class="mt-2 grid grid-cols-3 gap-2">
              <div class="rounded-ui-md border border-border bg-muted/30 p-2 text-center">
                <span class="block text-xs text-muted-foreground">Campaigns</span>
                <span class="text-base font-semibold">{{ countsLoading() ? '…' : projectCounts()?.campaigns ?? 0 }}</span>
              </div>
              <div class="rounded-ui-md border border-border bg-muted/30 p-2 text-center">
                <span class="block text-xs text-muted-foreground">Templates</span>
                <span class="text-base font-semibold">{{ countsLoading() ? '…' : projectCounts()?.templates ?? 0 }}</span>
              </div>
              <div class="rounded-ui-md border border-border bg-muted/30 p-2 text-center">
                <span class="block text-xs text-muted-foreground">Data files</span>
                <span class="text-base font-semibold">{{ countsLoading() ? '…' : projectCounts()?.uploads ?? 0 }}</span>
              </div>
            </dd>
          </div>
        </dl>
        <div class="mt-6 flex justify-end">
          <button hlmBtn variant="outline" type="button" (click)="closeDetail()">Close</button>
        </div>
      }
    </app-drawer>

    <!-- Delete Confirm Modal -->
    <app-confirm-modal
      [open]="confirmingDelete() !== null"
      [title]="'Delete ' + (confirmingDelete()?.name ?? 'project') + '?'"
      [message]="'This will permanently remove ' + (confirmingDelete()?.name ?? 'this project') + ' and its associated resources.'"
      confirmLabel="Delete project"
      (cancelled)="confirmingDelete.set(null)"
      (confirmed)="deleteProject()"
    />
  `,
})
export class ProjectsPage {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);

  readonly projects = signal<Project[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly mutationError = signal<string | null>(null);
  readonly metadata = signal<PageMetadata>({ page: 1, limit: 20, total: 0 });
  readonly page = signal(1);
  readonly query = signal('');
  readonly sortBy = signal<ProjectSort>('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');

  readonly formOpen = signal(false);
  readonly formName = signal('');
  readonly editingProject = signal<Project | null>(null);
  protected readonly pageActions: RowActionItem[] = [{ id: 'new', label: 'New project', icon: 'plus' }];
  readonly confirmingDelete = signal<Project | null>(null);
  readonly saving = signal(false);

  readonly detailProject = signal<Project | null>(null);
  readonly projectCounts = signal<ProjectCounts | null>(null);
  readonly countsLoading = signal(false);

  readonly listState = computed(() =>
    this.loading() ? 'loading' : this.error() ? 'error' : 'ready'
  );

  readonly projectActions: RowActionItem[] = [
    { id: 'detail', label: 'Detail', icon: 'eye' },
    { id: 'rename', label: 'Rename', icon: 'pencil' },
    { id: 'delete', label: 'Delete', icon: 'trash', destructive: true },
  ];

  constructor() {
    this.loadProjects();
  }

  loadProjects(): void {
    this.loading.set(true);
    this.error.set(null);
    const query: ListQuery = {
      page: this.page(),
      limit: 20,
      q: this.query(),
      sortBy: this.sortBy(),
      sortDir: this.sortDir(),
    };
    this.api.getPage<Project>(`/projects${listQueryString(query)}`).subscribe({
      next: (result) => {
        this.projects.set(result.data);
        this.metadata.set(result.metadata);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Check your connection and try again.');
        this.loading.set(false);
      },
    });
  }

  onSearch(query: string): void {
    this.query.set(query);
    this.page.set(1);
    this.loadProjects();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.loadProjects();
  }

  onSortSelect(event: Event): void {
    this.onSort({
      sortBy: (event.currentTarget as HTMLSelectElement).value,
      sortDir: this.sortDir(),
    });
  }

  onSort(sort: { sortBy: string; sortDir: 'asc' | 'desc' }): void {
    if (!['name', 'createdAt', 'updatedAt'].includes(sort.sortBy)) return;
    this.sortBy.set(sort.sortBy as ProjectSort);
    this.sortDir.set(sort.sortDir);
    this.page.set(1);
    this.loadProjects();
  }

  ariaSort(key: ProjectSort): 'ascending' | 'descending' | 'none' {
    return this.sortBy() === key
      ? this.sortDir() === 'asc'
        ? 'ascending'
        : 'descending'
      : 'none';
  }

  openAddForm(): void {
    this.editingProject.set(null);
    this.formName.set('');
    this.formOpen.set(true);
  }

  openEditForm(project: Project): void {
    this.editingProject.set(project);
    this.formName.set(project.name);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editingProject.set(null);
  }

  openDetail(project: Project): void {
    this.detailProject.set(project);
    this.projectCounts.set(null);
    this.countsLoading.set(true);
    forkJoin({
      campaigns: this.api.getPage<unknown>(`/projects/${project.id}/campaigns?page=1&limit=1`),
      templates: this.api.getPage<unknown>(`/projects/${project.id}/templates?page=1&limit=1`),
      uploads: this.api.get<unknown[]>(`/projects/${project.id}/uploads`),
    }).subscribe({
      next: (result) => {
        this.projectCounts.set({
          campaigns: result.campaigns.metadata.total,
          templates: result.templates.metadata.total,
          uploads: result.uploads.length,
        });
        this.countsLoading.set(false);
      },
      error: () => {
        this.countsLoading.set(false);
      },
    });
  }

  closeDetail(): void {
    this.detailProject.set(null);
    this.projectCounts.set(null);
  }

  handleProjectAction(action: RowActionItem, project: Project): void {
    if (action.id === 'detail') {
      // this.openDetail(project);
      this.router.navigate([`/projects/${project.id}/overview`])
    } else if (action.id === 'rename') {
      this.openEditForm(project);
    } else if (action.id === 'delete') {
      this.confirmingDelete.set(project);
    }
  }

  onFormNameInput(event: Event): void {
    this.formName.set((event.currentTarget as HTMLInputElement).value);
  }

  saveProject(): void {
    const name = this.formName().trim();
    if (!name || name.length > 100 || this.saving()) return;
    const editing = this.editingProject();
    this.saving.set(true);
    this.mutationError.set(null);
    if (editing) {
      this.api.patch<Project, { name: string }>(`/projects/${editing.id}`, { name }).subscribe({
        next: (updated) => {
          this.projects.update((items) =>
            items.map((item) => (item.id === updated.id ? updated : item))
          );
          this.saving.set(false);
          this.closeForm();
        },
        error: () => {
          this.mutationError.set('Could not rename the project. Please try again.');
          this.saving.set(false);
        },
      });
      return;
    }
    this.api.post<Project, { name: string }>('/projects', { name }).subscribe({
      next: (created) => {
        this.projects.update((items) => [created, ...items]);
        this.metadata.update((current) => ({ ...current, total: current.total + 1 }));
        this.saving.set(false);
        this.closeForm();
      },
      error: () => {
        this.mutationError.set('Could not create the project. Please try again.');
        this.saving.set(false);
      },
    });
  }

  deleteProject(): void {
    const project = this.confirmingDelete();
    if (!project || this.saving()) return;
    this.saving.set(true);
    this.mutationError.set(null);
    this.api.delete<Project>(`/projects/${project.id}`).subscribe({
      next: () => {
        this.projects.update((items) => items.filter((item) => item.id !== project.id));
        this.metadata.update((current) => ({ ...current, total: Math.max(0, current.total - 1) }));
        this.confirmingDelete.set(null);
        this.saving.set(false);
      },
      error: () => {
        this.mutationError.set('Could not delete the project. Please try again.');
        this.saving.set(false);
      },
    });
  }

  openProject(event: MouseEvent, projectId: string): void {
    event.preventDefault();
    void this.router.navigate(['/projects', projectId]);
  }
}
