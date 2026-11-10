import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPlus } from '@ng-icons/tabler-icons';
import { HlmBadge } from '../../ui/badge/src';
import { HlmButton } from '../../ui/button/src';
import { ConfirmModal, DataTableControls, Drawer, ListBody, PageHeader, Pagination, RowActions, type RowActionItem, SelectControl } from '../../ui';
import { type AdminUser, UsersService } from '../users/users.service';
import { type BroadcastAudience, type BroadcastItem, type BroadcastPayload, type BroadcastPreview, type BroadcastSort, BroadcastsService } from './broadcasts.service';
import { Ripple } from '../../ui/shared/ripple';

@Component({
  selector: 'app-broadcasts-page',
  providers: [provideIcons({ tablerPlus })],
  imports: [Ripple, CommonModule, NgIcon, HlmBadge, HlmButton, ConfirmModal, DataTableControls, Drawer, ListBody, PageHeader, Pagination, RowActions, SelectControl],
  template: `
    <app-page-header
      title="Broadcasts"
      description="Prepare announcements for workspace users."
      badge="Admin"
      [topLevel]="true"
    >
      <button page-actions hlmBtn type="button" class="max-md:hidden" aria-label="Create broadcast" (click)="openComposer()"><ng-icon name="tablerPlus" aria-hidden="true" class="size-4" />New broadcast</button>
      <app-row-actions page-actions class="md:hidden" [solid]="true" label="Page actions" [items]="pageActions" (actionSelect)="openComposer()" />
    </app-page-header>
    <app-data-table-controls [query]="query()" searchPlaceholder="Search broadcasts..." (queryChange)="search($event)"><div table-filters class="flex flex-wrap items-end gap-3">
      <label class="grid min-w-36 gap-1 text-xs font-medium text-muted-foreground">Sort by<select appSelect aria-label="Sort broadcasts" class="h-control-9 rounded-ui-md border border-input bg-background px-3 text-sm" [value]="sortBy()" (change)="sort($event)"><option value="createdAt">Created</option><option value="subject">Subject</option><option value="status">Status</option><option value="sentAt">Sent date</option></select></label>
    </div></app-data-table-controls>
    @if (notice()) { <p role="status" class="text-sm text-emerald-700 dark:text-emerald-300">{{ notice() }}</p> }
    <app-list-body
      [state]="listState()"
      [itemCount]="items().length"
      [query]="query()"
      loadingLabel="Loading broadcasts"
      errorTitle="Could not load broadcasts"
      [errorMessage]="error() || 'Please try again.'"
      emptyTitle="No broadcasts yet"
      emptyMessage="Create a draft to preview an announcement before sending."
      (retry)="load()"
      (clearQuery)="search('')"
    >
      <button empty-action hlmBtn class="mt-4" type="button" (click)="openComposer()">Create a broadcast</button>
      <div list-content class="overflow-x-auto rounded-ui-lg border border-border bg-card">
        <table data-responsive class="w-full min-w-[44rem] text-left text-sm" aria-label="Broadcast history">
          <thead class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr><th class="px-4 py-3">Subject</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Audience</th><th class="px-4 py-3">Counts</th><th class="px-4 py-3">Updated</th><th class="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody class="divide-y divide-border">
            @for (item of items(); track item.id) {
              <tr class="hover:bg-muted/30">
                <td data-label="Subject" class="px-4 py-4 font-medium">{{ item.subject }}</td>
                <td data-label="Status" class="px-4 py-4"><span hlmBadge [variant]="item.status === 'sent' ? 'secondary' : 'outline'">{{ item.status === 'sent' ? 'Sent' : 'Draft' }}</span></td>
                <td data-label="Audience" class="px-4 py-4">{{ audienceLabel(item) }}</td>
                <td data-label="Counts" class="px-4 py-4 tabular-nums">{{ item.counts.sent }} sent · {{ item.counts.failed }} failed</td>
                <td data-label="Updated" class="px-4 py-4 tabular-nums">{{ item.updatedAt | date:'mediumDate' }}</td>
                <td data-label="Actions" class="px-4 py-4 text-right">
                  <div class="flex justify-end">
                    @if (item.status === 'draft') {
                      <app-row-actions
                        [label]="'Actions for ' + item.subject"
                        [items]="draftActions(item)"
                        (actionSelect)="handleDraftAction(item, $event)"
                      />
                    } @else {
                      <button hlmBtn variant="outline" size="sm" type="button" [attr.aria-label]="'View ' + item.subject" (click)="openDetail(item)">Detail</button>
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </app-list-body>
    @if (listState() === 'ready' && items().length) {
      <app-pagination [metadata]="metadata()" (pageChange)="page.set($event); load()" />
    }

    <!-- Read-only Detail Drawer -->
    <app-drawer [open]="detailItem() !== null" title="Broadcast details" (closed)="detailItem.set(null)">
      @if (detailItem(); as item) {
        <dl class="grid gap-4 text-sm">
          <div><dt class="text-muted-foreground">Subject</dt><dd class="font-medium">{{ item.subject }}</dd></div>
          <div><dt class="text-muted-foreground">Status</dt><dd class="font-medium">{{ item.status === 'sent' ? 'Sent' : 'Draft' }}</dd></div>
          <div><dt class="text-muted-foreground">Audience</dt><dd class="font-medium">{{ audienceLabel(item) }}</dd></div>
          <div><dt class="text-muted-foreground">Plain-text message</dt><dd class="whitespace-pre-wrap font-normal">{{ item.bodyText }}</dd></div>
          <div><dt class="text-muted-foreground">Counts</dt><dd class="font-medium">{{ item.counts.sent }} sent · {{ item.counts.failed }} failed</dd></div>
          @if (item.sentAt) { <div><dt class="text-muted-foreground">Sent at</dt><dd class="font-medium">{{ item.sentAt | date:'medium' }}</dd></div> }
          <div><dt class="text-muted-foreground">Updated at</dt><dd class="font-medium">{{ item.updatedAt | date:'medium' }}</dd></div>
        </dl>
      }
    </app-drawer>

    <!-- Composer Drawer -->
    <app-drawer [open]="composerOpen()" [title]="preview() ? 'Review broadcast' : editingId() ? 'Edit draft' : 'Compose broadcast'" (closed)="closeComposer()">
      @if (!preview()) {
        <form id="broadcast-form" class="space-y-5" (submit)="$event.preventDefault(); preparePreview()">
          <label class="grid gap-2 text-sm font-medium" for="broadcast-subject">Subject<input id="broadcast-subject" class="h-control-9 rounded-ui-md border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" maxlength="255" [value]="subject()" (input)="subject.set(inputValue($event))" placeholder="Email subject" required /></label>
          <label class="grid gap-2 text-sm font-medium" for="broadcast-body">Plain-text message<textarea id="broadcast-body" class="min-h-40 rounded-ui-md border border-input bg-background p-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" maxlength="10000" [value]="bodyText()" (input)="bodyText.set(inputValue($event))" placeholder="Write your message" required></textarea></label>
          <label class="grid gap-2 text-sm font-medium" for="broadcast-audience">Audience<select id="broadcast-audience" appSelect class="h-control-9 rounded-ui-md border border-input bg-background px-3 text-sm font-normal" [value]="audience()" (change)="setAudience($event)"><option value="all">All users</option><option value="role">By role</option><option value="users">Choose users</option></select></label>
          @if (audience() === 'role') { <label class="grid gap-2 text-sm font-medium" for="broadcast-role">Role<select id="broadcast-role" appSelect class="h-control-9 rounded-ui-md border border-input bg-background px-3 text-sm font-normal" [value]="role()" (change)="role.set(inputValue($event))"><option value="user">User</option><option value="admin">Admin</option></select></label> }
          @if (audience() === 'users') { <fieldset class="grid gap-2"><legend class="text-sm font-medium">Choose users</legend>@if (usersLoading()) { <p role="status">Loading users…</p> } @else { @for (user of users(); track user.id) { <label class="flex h-control-9 items-center gap-3 rounded-ui-md border border-border px-3 text-sm"><input type="checkbox" [checked]="selectedUserIds().includes(user.id)" (change)="toggleUser(user.id, $event)" />{{ user.name || user.email }} <span class="text-muted-foreground">{{ user.email }}</span></label> } @if (selectedUserIds().length === 0) { <p class="text-xs text-muted-foreground">Select at least one recipient to preview this broadcast.</p> } }</fieldset> }
          @if (error()) { <p role="alert" class="rounded-ui-md border border-[#E5484D]/30 bg-[#E5484D]/10 px-3 py-2 text-sm text-[#E5484D]">{{ error() }}</p> }
        </form>
      } @else { <section class="space-y-5" aria-label="Broadcast preview"><div class="rounded-ui-md border border-border bg-muted/40 p-4"><p class="text-xs font-medium text-muted-foreground">RECIPIENTS</p><p class="mt-1 text-xl font-semibold tabular-nums">{{ preview()?.recipientCount }} recipients</p><p class="mt-1 text-xs text-muted-foreground">Sample: {{ preview()?.sampleEmails?.join(', ') || 'No sample addresses' }}</p></div><div><h3 class="text-sm font-semibold">{{ preview()?.renderedSubject }}</h3><p class="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{{ preview()?.renderedBodyText }}</p></div>@if (error()) { <p role="alert" class="rounded-ui-md border border-[#E5484D]/30 bg-[#E5484D]/10 px-3 py-2 text-sm text-[#E5484D]">{{ error() }}</p> }</section> }
      @if (!preview()) { <div drawer-footer class="contents"><button hlmBtn variant="outline" type="button" (click)="closeComposer()">Cancel</button><button hlmBtn type="submit" form="broadcast-form" aria-label="Preview broadcast" [disabled]="saving() || !subject().trim() || !bodyText().trim() || (audience() === 'users' && selectedUserIds().length === 0)">{{ saving() ? 'Saving…' : 'Preview' }}</button></div> } @else { <div drawer-footer class="contents"><button hlmBtn variant="outline" type="button" (click)="preview.set(null)">Back to edit</button><button hlmBtn type="button" aria-label="Send broadcast" (click)="confirmSend.set(true)">Send</button></div> }
    </app-drawer>
    <app-confirm-modal [open]="confirmSend()" title="Send this broadcast?" message="This sends the announcement now. Sent broadcasts cannot be edited or deleted." confirmLabel="Send broadcast" (cancelled)="confirmSend.set(false)" (confirmed)="send()" />
    <app-confirm-modal [open]="deletingItem() !== null" title="Delete broadcast draft?" message="This draft will be permanently deleted." confirmLabel="Delete draft" (cancelled)="deletingItem.set(null)" (confirmed)="deleteDraft()" />
  `,
})
export class BroadcastsPage implements OnInit {
  protected readonly pageActions: RowActionItem[] = [{ id: 'new', label: 'New broadcast', icon: 'plus' }];
  private readonly service = inject(BroadcastsService);
  private readonly usersService = inject(UsersService);
  readonly items = signal<BroadcastItem[]>([]);
  readonly metadata = signal({ page: 1, limit: 20, total: 0 });
  readonly page = signal(1);
  readonly query = signal('');
  readonly sortBy = signal<BroadcastSort>('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly usersLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly listState = computed(() => this.loading() ? 'loading' : this.error() ? 'error' : 'ready');
  readonly notice = signal<string | null>(null);
  readonly composerOpen = signal(false);
  readonly confirmSend = signal(false);
  readonly deletingItem = signal<BroadcastItem | null>(null);
  readonly detailItem = signal<BroadcastItem | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly preview = signal<BroadcastPreview | null>(null);
  readonly subject = signal('');
  readonly bodyText = signal('');
  readonly audience = signal<BroadcastAudience>('all');
  readonly role = signal('user');
  readonly users = signal<AdminUser[]>([]);
  readonly selectedUserIds = signal<string[]>([]);

  draftActions(item: BroadcastItem): RowActionItem[] {
    void item;
    return [
      { id: 'detail', label: 'Detail', icon: 'eye' },
      { id: 'edit', label: 'Edit', icon: 'pencil' },
      { id: 'delete', label: 'Delete', icon: 'trash', destructive: true },
    ];
  }

  handleDraftAction(item: BroadcastItem, action: RowActionItem): void {
    if (action.id === 'detail') this.openDetail(item);
    else if (action.id === 'edit') this.edit(item);
    else if (action.id === 'delete') this.deletingItem.set(item);
  }

  openDetail(item: BroadcastItem): void {
    this.detailItem.set(item);
  }

  deleteDraft(): void {
    const item = this.deletingItem();
    if (!item) return;
    this.saving.set(true);
    this.service.delete(item.id).subscribe({
      next: () => {
        this.items.update((all) => all.filter((i) => i.id !== item.id));
        this.deletingItem.set(null);
        this.saving.set(false);
        this.notice.set('Draft deleted');
      },
      error: () => {
        this.error.set('Could not delete draft.');
        this.deletingItem.set(null);
        this.saving.set(false);
      },
    });
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true); this.error.set(null);
    this.service.list({ page: this.page(), limit: 20, q: this.query(), sortBy: this.sortBy(), sortDir: this.sortDir() }).subscribe({
      next: (result) => { this.items.set(result.data); this.metadata.set(result.metadata); this.loading.set(false); },
      error: () => { this.error.set('Please try again.'); this.loading.set(false); },
    });
  }
  search(value: string): void { this.query.set(value); this.page.set(1); this.load(); }
  sort(event: Event): void { this.sortBy.set((event.currentTarget as HTMLSelectElement).value as BroadcastSort); this.page.set(1); this.load(); }
  inputValue(event: Event): string { return (event.currentTarget as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value; }
  audienceLabel(item: BroadcastItem): string { return item.audience === 'all' ? 'All users' : item.audience === 'role' ? `Role: ${String(item.audienceFilter?.['role'] ?? '')}` : `${Array.isArray(item.audienceFilter?.['userIds']) ? item.audienceFilter['userIds'].length : 0} selected users`; }
  openComposer(): void { this.resetComposer(); this.composerOpen.set(true); }
  edit(item: BroadcastItem): void { this.resetComposer(); this.editingId.set(item.id); this.subject.set(item.subject); this.bodyText.set(item.bodyText); this.audience.set(item.audience); this.role.set(String(item.audienceFilter?.['role'] ?? 'user')); this.selectedUserIds.set(Array.isArray(item.audienceFilter?.['userIds']) ? item.audienceFilter['userIds'].filter((id): id is string => typeof id === 'string') : []); this.composerOpen.set(true); if (item.audience === 'users') this.loadUsers(); }
  closeComposer(): void { this.composerOpen.set(false); this.confirmSend.set(false); this.resetComposer(); }
  setAudience(event: Event): void { this.audience.set(this.inputValue(event) as BroadcastAudience); if (this.audience() === 'users') this.loadUsers(); }
  loadUsers(): void { this.usersLoading.set(true); this.usersService.list({ page: 1, limit: 100, query: '', sortBy: 'email', sortDir: 'asc' }).subscribe({ next: ({ data }) => { this.users.set(data); this.usersLoading.set(false); }, error: () => { this.error.set('Could not load users.'); this.usersLoading.set(false); } }); }
  toggleUser(id: string, event: Event): void { const checked = (event.currentTarget as HTMLInputElement).checked; this.selectedUserIds.update((ids) => checked ? [...new Set([...ids, id])] : ids.filter((candidate) => candidate !== id)); }
  preparePreview(): void {
    const payload = this.payload(); if (!payload || this.saving()) return;
    this.error.set(null); this.saving.set(true);
    const save = this.editingId() ? this.service.update(this.editingId()!, payload) : this.service.create(payload);
    save.subscribe({ next: (item) => { this.editingId.set(item.id); this.service.preview(item.id).subscribe({ next: (result) => { this.preview.set(result); this.saving.set(false); }, error: () => { this.error.set('Could not prepare preview.'); this.saving.set(false); } }); }, error: () => { this.error.set('Draft could not be saved.'); this.saving.set(false); } });
  }
  send(): void { const id = this.editingId(); if (!id || this.saving()) return; this.saving.set(true); this.error.set(null); this.service.send(id).subscribe({ next: (item) => { this.items.update((items) => [item, ...items.filter((candidate) => candidate.id !== item.id)]); const message = item.counts.emailSkipped ? 'Broadcast sent; email delivery is not configured.' : 'Broadcast sent'; this.saving.set(false); this.confirmSend.set(false); this.closeComposer(); this.notice.set(message); }, error: () => { this.error.set('Broadcast could not be sent.'); this.saving.set(false); this.confirmSend.set(false); } }); }
  private payload(): BroadcastPayload | null {
    const base = { subject: this.subject().trim(), bodyText: this.bodyText().trim(), audience: this.audience() };
    if (base.audience === 'all') return base;
    if (base.audience === 'role') return { ...base, audienceFilter: { role: this.role() } };
    const userIds = this.selectedUserIds(); return userIds.length ? { ...base, audienceFilter: { userIds } } : null;
  }
  private resetComposer(): void { this.error.set(null); this.notice.set(null); this.editingId.set(null); this.preview.set(null); this.subject.set(''); this.bodyText.set(''); this.audience.set('all'); this.role.set('user'); this.selectedUserIds.set([]); }
}
