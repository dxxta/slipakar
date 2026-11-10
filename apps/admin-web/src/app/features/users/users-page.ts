import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, inject, signal } from '@angular/core';
import { HlmBadge } from '../../ui/badge/src';
import { HlmButton } from '../../ui/button/src';
import { ConfirmModal, DataTableControls, Drawer, ListBody, PageHeader, Pagination, RowActions, type RowActionItem, SelectControl } from '../../ui';
import { type AdminUser, type AdminUserSort, UsersService } from './users.service';
import { Ripple } from '../../ui/shared/ripple';

@Component({
  selector: 'app-users-page',
  imports: [Ripple, CommonModule, HlmBadge, HlmButton, ConfirmModal, DataTableControls, Drawer, ListBody, PageHeader, Pagination, RowActions, SelectControl],
  template: `
    <app-page-header
      title="Users"
      description="Manage accounts and access to the workspace."
      badge="Admin"
      [topLevel]="true"
    />
    <app-data-table-controls [query]="query()" searchPlaceholder="Search users..." (queryChange)="search($event)"><div table-filters class="flex flex-wrap items-end gap-3">
      <label class="grid min-w-40 gap-1 text-xs font-medium text-muted-foreground">Sort by<select appSelect aria-label="Sort users" class="h-control-9 rounded-ui-md border border-input bg-background px-3 text-sm" [value]="sortBy()" (change)="sort($event)"><option value="createdAt">Created</option><option value="name">Name</option><option value="email">Email</option><option value="role">Role</option><option value="status">Status</option></select></label>
      <label class="grid min-w-32 gap-1 text-xs font-medium text-muted-foreground">Direction<select appSelect aria-label="Sort direction" class="h-control-9 rounded-ui-md border border-input bg-background px-3 text-sm" [value]="sortDir()" (change)="setDirection($event)"><option value="desc">Newest</option><option value="asc">Oldest</option></select></label>
    </div></app-data-table-controls>
    <app-list-body
      [state]="listState()"
      [itemCount]="users().length"
      [query]="query()"
      loadingLabel="Loading users"
      errorTitle="Could not load users"
      [errorMessage]="error() || 'The user list could not be loaded. Please try again.'"
      emptyTitle="No users found"
      emptyMessage="There are no user accounts yet."
      (retry)="load()"
      (clearQuery)="search('')"
    >
      <div list-content class="overflow-x-auto rounded-ui-lg border border-border bg-card">
        <table data-responsive class="w-full text-left text-sm" aria-label="Users">
          <thead class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr><th class="px-4 py-3">User</th><th class="px-4 py-3">Role</th><th class="px-4 py-3">Projects</th><th class="px-4 py-3">Status</th><th class="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody class="divide-y divide-border">
            @for (user of users(); track user.id) {
              <tr class="hover:bg-muted/40">
                <td data-label="User" class="max-w-xs px-4 py-4"><p class="truncate font-medium">{{ user.name || 'Unnamed user' }}</p><p class="truncate text-xs text-muted-foreground">{{ user.email }}</p></td>
                <td data-label="Role" class="px-4 py-4">{{ user.role }}</td>
                <td data-label="Projects" class="px-4 py-4 tabular-nums">{{ user.projectCount }}</td>
                <td data-label="Status" class="px-4 py-4">@if (user.disabledAt) { <span hlmBadge variant="destructive">Disabled</span> } @else { <span hlmBadge variant="secondary">Active</span> }</td>
                <td data-label="Actions" class="px-4 py-4 text-right">
                  <div class="flex justify-end">
                    <app-row-actions
                      [label]="'Actions for ' + user.email"
                      [items]="userActions(user)"
                      (actionSelect)="handleUserAction(user, $event)"
                    />
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </app-list-body>
    @if (listState() === 'ready' && users().length) {
      <app-pagination [metadata]="metadata()" (pageChange)="page.set($event); load()" />
    }

    <app-drawer [open]="drawerMode() !== null" [title]="drawerMode() === 'edit' ? 'Edit user' : 'User details'" (closed)="closeDrawer()">
      @if (selectedUser(); as user) {
        @if (drawerMode() === 'view') {
          <dl class="grid gap-4 text-sm">
            <div><dt class="text-muted-foreground">Name</dt><dd class="font-medium">{{ user.name || '—' }}</dd></div>
            <div><dt class="text-muted-foreground">Email</dt><dd class="font-medium">{{ user.email }}</dd></div>
            <div><dt class="text-muted-foreground">Image</dt><dd class="break-all font-medium">{{ user.image || '—' }}</dd></div>
            <div><dt class="text-muted-foreground">Role</dt><dd class="font-medium">{{ user.role }}</dd></div>
            <div><dt class="text-muted-foreground">Email verified</dt><dd class="font-medium">{{ user.emailVerified ? 'Yes' : 'No' }}</dd></div>
            <div><dt class="text-muted-foreground">Created</dt><dd class="font-medium tabular-nums">{{ user.createdAt | date:'medium' }}</dd></div>
            <div><dt class="text-muted-foreground">Disabled at</dt><dd class="font-medium tabular-nums">{{ user.disabledAt ? (user.disabledAt | date:'medium') : '—' }}</dd></div>
            <div><dt class="text-muted-foreground">Projects</dt><dd class="font-medium tabular-nums">{{ user.projectCount }}</dd></div>
          </dl>
        }
        @else {
          <form id="user-form" class="space-y-4" (submit)="$event.preventDefault(); saveUser()">
            <div class="grid gap-2"><label for="user-name" class="text-sm font-medium">Name</label><input id="user-name" class="h-control-9 rounded-ui-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" [value]="editName()" (input)="editName.set(inputValue($event))" maxlength="100" placeholder="User name" /></div>
            <div class="grid gap-2"><label for="user-image" class="text-sm font-medium">Image URL</label><input id="user-image" type="url" class="h-control-9 rounded-ui-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" [value]="editImage()" (input)="onImageInput($event)" placeholder="https://example.com" /></div>
            <p class="text-xs text-muted-foreground">Only absolute image URLs can be saved here. A blank image keeps the current value unless you edit this field.</p>
            @if (error()) { <p role="alert" class="text-sm text-destructive">{{ error() }}</p> }
          </form>
        }
      }
      @if (selectedUser()) {
        @if (drawerMode() === 'view') {
          <div drawer-footer class="contents"><button hlmBtn variant="outline" type="button" (click)="closeDrawer()">Close</button></div>
        } @else {
          <div drawer-footer class="contents">
            <button hlmBtn variant="outline" type="button" (click)="closeDrawer()">Cancel</button>
            <button hlmBtn type="submit" form="user-form" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save user' }}</button>
          </div>
        }
      }
    </app-drawer>
    <app-confirm-modal
      [open]="confirmTarget() !== null"
      [title]="(confirmTarget()?.disabledAt ? 'Enable ' : 'Disable ') + (confirmTarget()?.email ?? 'user') + '?'"
      [message]="confirmTarget()?.disabledAt ? 'This account will be able to sign in again.' : 'This account will be prevented from signing in.'"
      [confirmLabel]="confirmTarget()?.disabledAt ? 'Enable user' : 'Disable user'"
      (cancelled)="confirmTarget.set(null)"
      (confirmed)="toggleDisabled()"
    />
  `,
})
export class UsersPage implements OnInit {
  private readonly service = inject(UsersService);
  readonly users = signal<AdminUser[]>([]);
  readonly metadata = signal({ page: 1, limit: 20, total: 0 });
  readonly page = signal(1);
  readonly query = signal('');
  readonly sortBy = signal<AdminUserSort>('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly listState = computed(() => this.loading() ? 'loading' : this.error() ? 'error' : 'ready');
  readonly drawerMode = signal<'view' | 'edit' | null>(null);
  readonly selectedUser = signal<AdminUser | null>(null);
  readonly confirmTarget = signal<AdminUser | null>(null);
  readonly editName = signal('');
  readonly editImage = signal('');
  readonly imageChanged = signal(false);

  userActions(user: AdminUser): RowActionItem[] {
    return [
      { id: 'detail', label: 'Detail', icon: 'eye' },
      { id: 'edit', label: 'Edit', icon: 'pencil' },
      user.disabledAt
        ? { id: 'enable', label: 'Enable', icon: 'power' }
        : { id: 'disable', label: 'Disable', icon: 'power', destructive: true },
    ];
  }

  handleUserAction(user: AdminUser, action: RowActionItem): void {
    if (action.id === 'detail') this.view(user);
    else if (action.id === 'edit') this.edit(user);
    else if (action.id === 'enable' || action.id === 'disable') this.confirmTarget.set(user);
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true); this.error.set(null);
    this.service.list({ page: this.page(), limit: 20, query: this.query(), sortBy: this.sortBy(), sortDir: this.sortDir() }).subscribe({
      next: (result) => { this.users.set(result.data); this.metadata.set(result.metadata); this.loading.set(false); },
      error: () => { this.error.set('The user list could not be loaded. Please try again.'); this.loading.set(false); },
    });
  }

  search(value: string): void { this.query.set(value); this.page.set(1); this.load(); }
  sort(event: Event): void { this.sortBy.set((event.currentTarget as HTMLSelectElement).value as AdminUserSort); this.page.set(1); this.load(); }
  setDirection(event: Event): void { this.sortDir.set((event.currentTarget as HTMLSelectElement).value as 'asc' | 'desc'); this.page.set(1); this.load(); }
  view(user: AdminUser): void { this.service.get(user.id).subscribe({ next: (result) => { this.selectedUser.set(result.data); this.drawerMode.set('view'); }, error: () => this.error.set('User details could not be loaded.') }); }
  edit(user: AdminUser): void {
    this.selectedUser.set(user);
    this.editName.set(user.name ?? '');
    this.editImage.set(user.image?.startsWith('http://') || user.image?.startsWith('https://') ? user.image : '');
    this.imageChanged.set(false);
    this.drawerMode.set('edit');
  }
  closeDrawer(): void { this.drawerMode.set(null); this.selectedUser.set(null); }
  inputValue(event: Event): string { return (event.currentTarget as HTMLInputElement).value; }
  onImageInput(event: Event): void { this.editImage.set(this.inputValue(event)); this.imageChanged.set(true); }

  saveUser(): void {
    const user = this.selectedUser(); if (!user || this.saving()) return;
    const image = this.editImage().trim();
    if (this.imageChanged() && image && !this.isAbsoluteImageUrl(image)) { this.error.set('Enter an absolute HTTP or HTTPS image URL.'); return; }
    const payload = this.imageChanged() ? { name: this.editName().trim(), image: image || null } : { name: this.editName().trim() };
    this.saving.set(true); this.error.set(null);
    this.service.update(user.id, payload).subscribe({
      next: ({ data }) => { this.users.update((items) => items.map((item) => item.id === data.id ? data : item)); this.saving.set(false); this.closeDrawer(); },
      error: () => { this.error.set('User details could not be saved.'); this.saving.set(false); },
    });
  }

  private isAbsoluteImageUrl(value: string): boolean {
    try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:'; } catch { return false; }
  }

  toggleDisabled(): void {
    const user = this.confirmTarget(); if (!user || this.saving()) return;
    this.saving.set(true);
    this.service.setDisabled(user.id, !user.disabledAt).subscribe({
      next: ({ data }) => { this.users.update((items) => items.map((item) => item.id === data.id ? data : item)); this.confirmTarget.set(null); this.saving.set(false); },
      error: () => { this.error.set('User access could not be updated.'); this.confirmTarget.set(null); this.saving.set(false); },
    });
  }
}
