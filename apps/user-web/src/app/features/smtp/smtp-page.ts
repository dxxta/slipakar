import { CommonModule } from '@angular/common';
import { SelectControl } from '../../ui/shared/select-control';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { HlmAlert, HlmAlertDescription, HlmAlertTitle } from '../../ui/alert/src';
import { HlmBadge } from '../../ui/badge/src';
import { HlmButton } from '../../ui/button/src';
import { HlmCard, HlmCardContent, HlmCardDescription, HlmCardHeader, HlmCardTitle } from '../../ui/card/src';
import { HlmSwitch } from '../../ui/switch/src';
import { DataTableControls } from '../../ui/shared/data-table-controls';
import { Pagination } from '../../ui/shared/pagination';
import { ConfirmModal, Drawer, ListBody, PageHeader, RowActions, type RowActionItem } from '../../ui';
import { type CreateSmtpPayload, type SmtpConnection, SmtpService, type UpdateSmtpPayload } from './smtp.service';

@Component({
  selector: 'app-smtp-page',
  imports: [
    SelectControl,
    CommonModule,
    HlmButton,
    HlmCard,
    HlmCardContent,
    HlmSwitch,
    HlmBadge,
    HlmAlert,
    HlmAlertTitle,
    HlmAlertDescription,
    DataTableControls,
    Drawer,
    ConfirmModal,
    ListBody,
    PageHeader,
    Pagination,
    RowActions,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `

  <div class="app-list-layout">
    <app-page-header
      title="SMTP Connections"
      [topLevel]="false"
      description="Configure SMTP connection settings to deliver emails."
    >
      @if (!showForm()) {
        <div page-actions class="flex items-center gap-2">
<button
          hlmBtn
          type="button"
          class="max-md:hidden"
          data-testid="add-smtp-button"
          (click)="openAddForm()"
        >
          Add connection
        </button>
        <app-row-actions class="md:hidden" [solid]="true" label="Page actions" [items]="pageActions" (actionSelect)="openAddForm()" />
</div>
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

    @if (!showForm()) {
      <app-data-table-controls [query]="listQuery()" searchPlaceholder="Search SMTP connections..." (queryChange)="searchConnections($event)">
        <div table-filters>
          <label class="grid min-w-40 gap-1 text-xs font-medium text-muted-foreground">
            Sort connections
            <select
              appSelect
              aria-label="Sort connections"
              class="h-control-9 rounded-ui-md border border-input bg-background px-3 text-sm"
              [value]="sortBy()"
              (change)="sortConnections($event)"
            >
              <option value="createdAt">Created</option>
              <option value="updatedAt">Updated</option>
              <option value="host">Host</option>
              <option value="port">Port</option>
              <option value="username">Username</option>
              <option value="fromAddress">From address</option>
            </select>
          </label>
        </div>
      </app-data-table-controls>
    }

    <!-- Add / Edit Drawer -->
    @if (showForm()) {
      <app-drawer [open]="showForm()" [title]="editingId() ? 'Edit SMTP connection' : 'Add SMTP connection'" (closed)="closeForm()">
      <div hlmCard data-testid="smtp-form-card" class="border-0 shadow-none">
        <div hlmCardContent>
          <p class="mb-4 text-sm text-muted-foreground">
            {{ editingId() ? 'Update connection details. Leave password empty to keep existing password.' : 'Enter your SMTP server configuration.' }}
          </p>
          <form id="smtp-form" class="space-y-4" (submit)="$event.preventDefault(); submitForm()">
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label for="smtp-host" class="mb-1 block text-sm font-medium">Host</label>
                <input
                  id="smtp-host"
                  data-testid="smtp-host-input"
                  class="h-control-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="smtp.example.com"
                  [value]="formHost()"
                  (input)="formHost.set($any($event.target).value)"
                  required
                />
              </div>
              <div>
                <label for="smtp-port" class="mb-1 block text-sm font-medium">Port</label>
                <input
                  id="smtp-port"
                  data-testid="smtp-port-input"
                  type="number"
                  class="h-control-9 w-full rounded-md border border-input bg-background px-3 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="587"
                  [value]="formPort()"
                  (input)="formPort.set($any($event.target).value)"
                  min="1"
                  max="65535"
                  required
                />
                @if (portValidationError()) {
                  <p class="mt-1 text-xs text-destructive" role="alert">{{ portValidationError() }}</p>
                }
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label for="smtp-username" class="mb-1 block text-sm font-medium">Username</label>
                <input
                  id="smtp-username"
                  data-testid="smtp-username-input"
                  class="h-control-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="user@example.com"
                  [value]="formUsername()"
                  (input)="onUsernameInput($any($event.target).value)"
                  required
                />
              </div>
              <div>
                <label for="smtp-password" class="mb-1 block text-sm font-medium">
                  Password {{ editingId() ? '(leave blank to keep current)' : '' }}
                </label>
                <input
                  id="smtp-password"
                  data-testid="smtp-password-input"
                  type="password"
                  autocomplete="new-password"
                  class="h-control-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Enter password"
                  [value]="formPassword()"
                  (input)="formPassword.set($any($event.target).value)"
                  [required]="!editingId()"
                />
              </div>
            </div>

            <div>
              <label for="smtp-from-address" class="mb-1 block text-sm font-medium">From Address</label>
              <input
                id="smtp-from-address"
                data-testid="smtp-from-address-input"
                type="email"
                class="h-control-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="noreply@example.com"
                [value]="formFromAddress()"
                (input)="formFromAddress.set($any($event.target).value)"
                required
              />
            </div>

            <div class="flex items-center gap-3 pt-2">
              <hlm-switch
                inputId="smtp-secure"
                [aria-label]="'Use SSL/TLS'"
                [checked]="formSecure()"
                (checkedChange)="formSecure.set($event)"
              />
              <label for="smtp-secure" class="text-sm font-medium">Use SSL/TLS (Secure)</label>
            </div>

          </form>
        </div>
      </div>
            <div drawer-footer class="contents">
              <button hlmBtn variant="outline" type="button" (click)="closeForm()">
                Cancel
              </button>
              <button
                hlmBtn
                type="submit"
                form="smtp-form"
                data-testid="smtp-save-button"
                [disabled]="isSaving() || !formHost().trim() || !formUsername().trim() || !!portValidationError() || (!editingId() && !formPassword().trim())"
              >
                {{ isSaving() ? 'Saving…' : (editingId() ? 'Save changes' : 'Create connection') }}
              </button>
            </div>
    </app-drawer>
    }

 <!-- Read-only Detail Drawer without secrets -->
    @if(detailConnection() !== null){
    <app-drawer [open]="detailConnection() !== null" [title]="detailConnection() ? (detailConnection()!.host + ':' + detailConnection()!.port) : 'Connection details'" (closed)="detailConnection.set(null)">
      @if (detailConnection(); as conn) {
        <dl class="space-y-4 text-sm">
          <div>
            <dt class="text-xs font-medium text-muted-foreground">Host</dt>
            <dd class="mt-1 font-medium">{{ conn.host }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-muted-foreground">Port</dt>
            <dd class="mt-1 font-medium tabular-nums">{{ conn.port }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-muted-foreground">Security</dt>
            <dd class="mt-1 font-medium">{{ conn.secure ? 'SSL/TLS' : 'STARTTLS / Plain' }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-muted-foreground">Username</dt>
            <dd class="mt-1 font-mono text-xs">{{ conn.username }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-muted-foreground">From address</dt>
            <dd class="mt-1 font-mono text-xs">{{ conn.fromAddress || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-muted-foreground">Created</dt>
            <dd class="mt-1 tabular-nums">{{ conn.createdAt ? (conn.createdAt | date: 'medium') : '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-muted-foreground">Updated</dt>
            <dd class="mt-1 tabular-nums">{{ conn.updatedAt ? (conn.updatedAt | date: 'medium') : '—' }}</dd>
          </div>
        </dl>
        <div class="mt-6 flex justify-end">
          <button hlmBtn variant="outline" type="button" (click)="detailConnection.set(null)">Close</button>
        </div>
      }
    </app-drawer>
    }

    <app-list-body
      [state]="listState()"
      [itemCount]="connections().length"
      [query]="listQuery()"
      loadingLabel="Loading SMTP connections"
      errorTitle="Failed to load SMTP connections"
      [errorMessage]="loadError() ?? 'Failed to load SMTP connections'"
      emptyTitle="No SMTP connections yet"
      emptyMessage="Add an SMTP connection to enable sending emails from this project."
      (retry)="loadConnections()"
      (clearQuery)="searchConnections('')"
    >
      <!-- Connections List -->
      <div list-content class="overflow-x-auto rounded-ui-lg border border-border" aria-label="SMTP connections">
        <table data-responsive aria-label="SMTP connections list" class="w-full min-w-[44rem] border-collapse text-left text-sm">
          <thead class="bg-muted/50 text-xs text-muted-foreground"><tr><th scope="col" class="px-4 py-3 font-medium">Host:port</th><th scope="col" class="px-4 py-3 font-medium">Username</th><th scope="col" class="px-4 py-3 font-medium">From</th><th scope="col" class="px-4 py-3 text-right font-medium">Actions</th></tr></thead>
          <tbody class="divide-y divide-border">
            @for (conn of connections(); track conn.id) {
              <tr [attr.data-testid]="'smtp-row-' + conn.id" [attr.data-row]="'smtp-card-' + conn.id" class="hover:bg-muted/30">
                <th data-label="Host:port" scope="row" class="px-4 py-3 font-medium tabular-nums">{{ conn.host }}:{{ conn.port }} @if (conn.secure) { <span hlmBadge variant="outline" class="ml-2 text-xs">SSL/TLS</span> }</th>
                <td data-label="Username" class="px-4 py-3 font-mono text-xs">{{ conn.username }}</td>
                <td data-label="From" class="px-4 py-3 font-mono text-xs">{{ conn.fromAddress || '—' }}</td>
                <td data-label="Actions" class="px-4 py-2 text-right"><div class="flex items-center justify-end gap-2"><div class="text-right">@if (isTestingId() === conn.id) { <p aria-live="polite" role="status" class="text-xs text-muted-foreground">Testing SMTP connection…</p> } @else if (testResults()[conn.id]?.ok) { <p aria-live="polite" role="status" class="text-xs text-green-700 dark:text-green-300">SMTP test connection successful!</p> } @else if (testResults()[conn.id]) { <p aria-live="polite" role="alert" class="text-xs text-destructive">SMTP test failed: {{ testResults()[conn.id]?.error }}</p> }</div><app-row-actions [label]="'Actions for ' + conn.host" [items]="rowActions" [attr.data-testid]="'smtp-actions-' + conn.id" (actionSelect)="handleAction($event, conn)" /></div></td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <button
        empty-action
        hlmBtn
        class="mt-4"
        type="button"
        data-testid="empty-add-smtp-button"
        (click)="openAddForm()"
      >
        Add connection
      </button>
    </app-list-body>

    <app-pagination [metadata]="listMetadata()" (pageChange)="changeListPage($event)" />
          </div>
    <app-confirm-modal
      [open]="pendingDelete() !== null"
      [title]="'Delete ' + (pendingDelete()?.host ?? 'this item') + '?'"
      message="This will permanently remove this SMTP connection."
      confirmLabel="Delete connection"
      [confirmTestId]="'confirm-delete-' + (pendingDelete()?.id ?? '')"
      (cancelled)="confirmingDeleteId.set(null)"
      (confirmed)="pendingDelete() && deleteConnection(pendingDelete()!.id)"
    />
  `,
})
export class SmtpPage implements OnInit {
  private readonly smtpService = inject(SmtpService);
  private readonly route = inject(ActivatedRoute);

  projectId = '';

  readonly connections = signal<SmtpConnection[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = signal<string | null>(null);

  readonly listQuery = signal('');
  readonly listMetadata = signal({ page: 1, limit: 20, total: 0 });
  readonly sortBy = signal<'host' | 'port' | 'username' | 'fromAddress' | 'createdAt' | 'updatedAt'>('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');

  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly detailConnection = signal<SmtpConnection | null>(null);
  readonly formHost = signal('');
  readonly formPort = signal('587');
  readonly formUsername = signal('');
  readonly formPassword = signal('');
  readonly formSecure = signal(false);
  readonly formFromAddress = signal('');
  readonly isSaving = signal(false);

  protected readonly pageActions: RowActionItem[] = [{ id: 'new', label: 'Add connection', icon: 'plus' }];
  readonly confirmingDeleteId = signal<string | null>(null);
  protected readonly pendingDelete = computed(() => this.connections().find((conn) => conn.id === this.confirmingDeleteId()) ?? null);
  readonly isTestingId = signal<string | null>(null);
  readonly testResults = signal<Record<string, { ok: boolean; error?: string }>>({});

  readonly listState = computed(() =>
    this.loading() ? 'loading' : this.loadError() ? 'error' : 'ready'
  );

  readonly portValidationError = computed(() => {
    const raw = this.formPort().trim();
    if (!raw) return 'Port is required.';
    const port = Number(raw);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return 'Port must be a number between 1 and 65535.';
    }
    return null;
  });

  readonly rowActions: RowActionItem[] = [
    { id: 'detail', label: 'Detail', icon: 'eye' },
    { id: 'edit', label: 'Edit', icon: 'pencil' },
    { id: 'delete', label: 'Delete', icon: 'trash', destructive: true },
    { id: 'test', label: 'Test connection', icon: 'power' },
  ];

  ngOnInit(): void {
    const parentRoute = this.route.parent;
    this.projectId =
      this.route.snapshot.paramMap.get('projectId') ??
      parentRoute?.snapshot.paramMap.get('projectId') ??
      '';
    this.loadConnections();
  }

  loadConnections(): void {
    if (!this.projectId) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.smtpService
      .list(
        this.projectId,
        this.listMetadata().page,
        this.listMetadata().limit,
        this.listQuery(),
        this.sortBy(),
        this.sortDir(),
      )
      .subscribe({
        next: (res) => {
          this.connections.set(res.data);
          this.listMetadata.set(res.metadata);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.loadError.set(err.message || 'Failed to load SMTP connections');
          this.loading.set(false);
        },
      });
  }

  searchConnections(query: string): void {
    this.listQuery.set(query);
    this.listMetadata.update((m) => ({ ...m, page: 1 }));
    this.loadConnections();
  }

  sortConnections(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.sortBy.set(select.value as 'host' | 'port' | 'username' | 'fromAddress' | 'createdAt' | 'updatedAt');
    this.listMetadata.update((m) => ({ ...m, page: 1 }));
    this.loadConnections();
  }

  changeListPage(page: number): void {
    this.listMetadata.update((m) => ({ ...m, page }));
    this.loadConnections();
  }

  handleAction(action: RowActionItem, conn: SmtpConnection): void {
    if (action.id === 'detail') {
      this.detailConnection.set(conn);
    } else if (action.id === 'edit') {
      this.openEditForm(conn);
    } else if (action.id === 'delete') {
      this.confirmingDeleteId.set(conn.id);
    } else if (action.id === 'test') {
      this.testConnection(conn.id);
    }
  }

  openAddForm(): void {
    this.editingId.set(null);
    this.formHost.set('');
    this.formPort.set('587');
    this.formUsername.set('');
    this.formPassword.set('');
    this.formSecure.set(false);
    this.formFromAddress.set('');
    this.actionError.set(null);
    this.actionSuccess.set(null);
    this.showForm.set(true);
  }

  openEditForm(conn: SmtpConnection): void {
    this.editingId.set(conn.id);
    this.formHost.set(conn.host);
    this.formPort.set(String(conn.port));
    this.formUsername.set(conn.username);
    this.formPassword.set('');
    this.formSecure.set(conn.secure);
    this.formFromAddress.set(conn.fromAddress || '');
    this.actionError.set(null);
    this.actionSuccess.set(null);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
    this.actionError.set(null);
  }

  onUsernameInput(val: string): void {
    this.formUsername.set(val);
    if (!this.editingId() && val.includes('@') && !this.formFromAddress()) {
      this.formFromAddress.set(val);
    }
  }

  submitForm(): void {
    const host = this.formHost().trim();
    const port = parseInt(this.formPort(), 10);
    const username = this.formUsername().trim();
    const password = this.formPassword().trim();
    const secure = this.formSecure();
    const fromAddress = this.formFromAddress().trim();

    if (!host || isNaN(port) || !username) {
      this.actionError.set('Please fill in all required fields.');
      return;
    }

    this.isSaving.set(true);
    this.actionError.set(null);
    this.actionSuccess.set(null);

    const editId = this.editingId();
    if (editId) {
      const orig = this.connections().find((c) => c.id === editId);
      const payload: UpdateSmtpPayload = {};
      if (orig) {
        if (host !== orig.host) payload.host = host;
        if (port !== orig.port) payload.port = port;
        if (username !== orig.username) payload.username = username;
        if (secure !== orig.secure) payload.secure = secure;
        if (fromAddress !== (orig.fromAddress || '')) payload.fromAddress = fromAddress;
      }
      if (password) payload.password = password;

      this.smtpService.update(this.projectId, editId, payload).subscribe({
        next: (res) => {
          this.connections.update((list) =>
            list.map((c) => (c.id === editId ? res : c))
          );
          this.isSaving.set(false);
          this.showForm.set(false);
          this.editingId.set(null);
          this.actionSuccess.set('SMTP connection updated successfully.');
        },
        error: (err: ApiError) => {
          this.actionError.set(err.message || 'Failed to update SMTP connection');
          this.isSaving.set(false);
        },
      });
    } else {
      if (!password) {
        this.actionError.set('Password is required.');
        this.isSaving.set(false);
        return;
      }
      const payload: CreateSmtpPayload = {
        host,
        port,
        username,
        password,
        secure,
        fromAddress,
      };

      this.smtpService.create(this.projectId, payload).subscribe({
        next: (res) => {
          this.connections.update((list) => [res, ...list]);
          this.listMetadata.update((m) => ({ ...m, total: m.total + 1 }));
          this.isSaving.set(false);
          this.showForm.set(false);
          this.actionSuccess.set('SMTP connection created successfully.');
        },
        error: (err: ApiError) => {
          this.actionError.set(err.message || 'Failed to create SMTP connection');
          this.isSaving.set(false);
        },
      });
    }
  }

  deleteConnection(id: string): void {
    this.actionError.set(null);
    this.smtpService.delete(this.projectId, id).subscribe({
      next: () => {
        this.connections.update((list) => list.filter((c) => c.id !== id));
        this.listMetadata.update((m) => ({ ...m, total: Math.max(0, m.total - 1) }));
        this.confirmingDeleteId.set(null);
        this.actionSuccess.set('SMTP connection deleted.');
      },
      error: (err: ApiError) => {
        this.actionError.set(err.message || 'Failed to delete SMTP connection');
        this.confirmingDeleteId.set(null);
      },
    });
  }

  testConnection(id: string): void {
    this.isTestingId.set(id);
    this.smtpService.test(this.projectId, id).subscribe({
      next: (res) => {
        this.testResults.update((prev) => ({ ...prev, [id]: res }));
        this.isTestingId.set(null);
      },
      error: (err: ApiError) => {
        this.testResults.update((prev) => ({
          ...prev,
          [id]: { ok: false, error: err.message || 'Connection test failed' },
        }));
        this.isTestingId.set(null);
      },
    });
  }
}
