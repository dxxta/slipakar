import { CommonModule } from '@angular/common';
import { SelectControl } from '../../ui/shared/select-control';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { HlmAlert, HlmAlertDescription, HlmAlertTitle } from '../../ui/alert/src';
import { HlmBadge } from '../../ui/badge/src';
import { HlmButton } from '../../ui/button/src';
import { DataTableControls } from '../../ui/shared/data-table-controls';
import { ListBody } from '../../ui/shared/list-body';
import { ConfirmModal } from '../../ui/shared/confirm-modal';
import { BackButton } from '../../ui/shared/back-button';
import { Pagination } from '../../ui/shared/pagination';
import {
  HlmCard,
  HlmCardContent,
  HlmCardDescription,
  HlmCardHeader,
  HlmCardTitle,
} from '../../ui/card/src';
import {
  type CampaignDetail,
  type CampaignRecipientItem,
  CampaignsService,
  type RecipientStatus,
} from './campaigns.service';

@Component({
  selector: 'app-campaign-detail-page',
  imports: [
    SelectControl,
    CommonModule,
    HlmButton,
    HlmBadge,
    HlmCard,
    HlmCardHeader,
    HlmCardTitle,
    HlmCardDescription,
    HlmCardContent,
    HlmAlert,
    HlmAlertTitle,
    HlmAlertDescription,
    DataTableControls,
    ListBody,
    ConfirmModal,
    Pagination,
    BackButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Top announcement aria-live for status updates -->
      <div class="sr-only" aria-live="assertive" data-testid="live-status-announcement">
        {{ liveAnnouncement() }}
      </div>

      <header class="flex flex-wrap items-start gap-3">
        <app-back-button [link]="['/projects', projectId(), 'campaigns']" label="Back to campaigns" />
        <div class="min-w-0 flex-1"><h1 class="text-3xl font-semibold tracking-tight">{{ 'Campaign #' + campaignId().slice(0, 8) }}</h1><p class="mt-2 text-sm text-muted-foreground">View real-time delivery status and recipient list.</p></div>
        <div class="ml-auto flex shrink-0 items-center gap-2">@if (campaign(); as camp) { <span hlmBadge [variant]="badgeVariant(camp.status)" data-testid="campaign-status-badge">{{ statusLabel(camp.status) }}</span> }@if (campaign()?.status === 'draft') { <button hlmBtn type="button" data-testid="send-campaign-button" (click)="openSendConfirm()">Send campaign</button> }</div>
      </header>

      @if (actionError()) {
        <div aria-live="polite" role="alert" data-testid="campaign-action-error">
          <div hlmAlert variant="destructive">
            <h4 hlmAlertTitle>Error</h4>
            <p hlmAlertDescription>{{ actionError() }}</p>
          </div>
        </div>
      }

      @if (actionSuccess()) {
        <div aria-live="polite" role="status" data-testid="campaign-action-success">
          <div hlmAlert class="border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200">
            <h4 hlmAlertTitle class="text-emerald-800 dark:text-emerald-200">Success</h4>
            <p hlmAlertDescription class="text-emerald-700 dark:text-emerald-300">{{ actionSuccess() }}</p>
          </div>
        </div>
      }

      <app-confirm-modal [open]="showConfirmSend()" title="Confirm Campaign Delivery" [message]="'Are you sure you want to send this campaign to all ' + (campaign()?.counts?.total ?? 0) + ' recipient(s)?'" [confirmLabel]="isSending() ? 'Sending…' : 'Yes, Send Now'" dialogTestId="send-confirm-dialog" messageTestId="confirm-send-message" confirmTestId="confirm-send-button" (cancelled)="showConfirmSend.set(false)" (confirmed)="confirmSend()" />

      @if (loading()) {
        <div data-testid="campaign-detail-skeleton" class="space-y-4 animate-pulse">
          <div class="h-28 rounded-lg bg-muted"></div>
          <div class="h-64 rounded-lg bg-muted"></div>
        </div>
      } @else if (campaign(); as camp) {
        <!-- Summary Cards Grid -->
        <div class="grid auto-rows-fr gap-4 grid-cols-2 lg:grid-cols-4" data-testid="summary-cards">
          <div hlmCard class="min-h-24 p-4">
            <p class="text-xs font-medium text-muted-foreground">Total Recipients</p>
            <p class="mt-2 text-2xl font-bold tabular-nums" data-testid="count-total">{{ camp.counts.total }}</p>
          </div>
          <div hlmCard class="min-h-24 p-4">
            <p class="text-xs font-medium text-muted-foreground">Sent Successfully</p>
            <p class="mt-2 text-2xl font-bold tabular-nums text-green-700 dark:text-green-300" data-testid="count-sent">{{ camp.counts.sent }}</p>
          </div>
          <div hlmCard class="min-h-24 p-4">
            <p class="text-xs font-medium text-muted-foreground">Failed Deliveries</p>
            <p class="mt-2 text-2xl font-bold tabular-nums text-destructive" data-testid="count-failed">{{ camp.counts.failed }}</p>
          </div>
          <div hlmCard class="min-h-24 p-4">
            <p class="text-xs font-medium text-muted-foreground">Pending in Queue</p>
            <p class="mt-2 text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300" data-testid="count-pending">{{ camp.counts.pending }}</p>
          </div>
        </div>

        <!-- Recipients List Card -->
        <div hlmCard>
          <div hlmCardHeader class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 hlmCardTitle>Recipients</h3>
              <p hlmCardDescription>Per-recipient delivery status and error diagnostics.</p>
            </div>

          </div>

          <app-data-table-controls [query]="recipientQuery()" searchPlaceholder="Search recipients..." (queryChange)="searchRecipients($event)"><div table-filters class="flex flex-wrap items-end gap-3">
            <label class="grid min-w-40 gap-1 text-xs font-medium text-muted-foreground">Status<select appSelect id="status-filter" data-testid="recipient-status-filter" class="h-control-9 rounded-ui-md border border-input bg-background px-2 text-sm" [value]="selectedStatusFilter()" (change)="onStatusFilterChange($event)"><option value="">All statuses</option><option value="pending">Pending</option><option value="sent">Sent</option><option value="failed">Failed</option></select></label>
            <label class="grid min-w-40 gap-1 text-xs font-medium text-muted-foreground">Sort recipients<select appSelect aria-label="Sort recipients" class="h-control-9 rounded-ui-md border border-input bg-background px-2 text-sm" [value]="recipientSortBy()" (change)="sortRecipients($event)"><option value="rowIndex">Row</option><option value="email">Email</option><option value="status">Status</option><option value="createdAt">Created</option><option value="updatedAt">Updated</option></select></label>
          </div></app-data-table-controls>

          <div hlmCardContent class="p-0">
            <app-list-body [state]="loadingRecipients() ? 'loading' : recipientsError() ? 'error' : 'ready'" [itemCount]="recipients().length" [query]="recipientQuery()" errorTitle="Could not load recipients" [errorMessage]="recipientsError() ?? ''" emptyTitle="No recipients yet" emptyMessage="This campaign has no recipients to display." emptyResultLabel="No recipients match" (retry)="loadRecipients()" (clearQuery)="searchRecipients('')">
              <div list-content class="overflow-x-auto rounded-ui-lg border border-border">
                <table class="w-full text-left text-sm" aria-label="Recipients delivery table">
                  <thead class="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
                    <tr>
                      <th scope="col" class="px-6 py-3">Row</th>
                      <th scope="col" class="px-6 py-3">Recipient Email</th>
                      <th scope="col" class="px-6 py-3">Status</th>
                      <th scope="col" class="px-6 py-3">Details / Error</th>
                      <th scope="col" class="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border">
                    @for (rec of recipients(); track rec.id) {
                      <tr class="hover:bg-muted/50 transition-colors" [attr.data-testid]="'recipient-row-' + rec.id">
                        <td class="px-6 py-3 font-mono text-xs text-muted-foreground tabular-nums">
                          #{{ rec.rowIndex + 1 }}
                        </td>
                        <td class="px-6 py-3 font-medium max-w-[16rem] truncate" [title]="rec.email">
                          {{ rec.email }}
                        </td>
                        <td class="px-6 py-3">
                          <span
                            hlmBadge
                            class="capitalize"
                            [variant]="recipientBadgeVariant(rec.status)"
                            [attr.data-testid]="'recipient-badge-' + rec.id"
                          >
                            {{ rec.status }}
                          </span>
                        </td>
                        <td class="px-6 py-3 text-xs text-muted-foreground max-w-xs truncate">
                          @if (rec.errorMessage) {
                            <span class="text-destructive font-mono" [title]="rec.errorMessage" [attr.data-testid]="'recipient-error-' + rec.id">
                              {{ rec.errorMessage }}
                            </span>
                          } @else {
                            <span>—</span>
                          }
                        </td>
                        <td class="px-6 py-3 text-right">
                          @if (rec.status === 'failed') {
                            <button
                              hlmBtn
                              variant="outline"
                              size="sm"
                              type="button"
                              [attr.data-testid]="'retry-recipient-' + rec.id"
                              [disabled]="retryingRecipientId() === rec.id"
                              (click)="retryRecipient(rec.id)"
                            >
                              {{ retryingRecipientId() === rec.id ? 'Retrying…' : 'Retry' }}
                            </button>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </app-list-body>
            <app-pagination [metadata]="{ page: currentPage(), limit: pageSize(), total: totalRecipients() }" (pageChange)="goToPage($event)" />
          </div>
        </div>
      }
    </div>
  `,
})
export class CampaignDetailPage implements OnInit, OnDestroy {
  private readonly campaignsService = inject(CampaignsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly projectId = signal<string>('');
  readonly campaignId = signal<string>('');

  readonly campaign = signal<CampaignDetail | null>(null);
  readonly recipients = signal<CampaignRecipientItem[]>([]);

  readonly loading = signal(true);
  readonly loadingRecipients = signal(false);
  readonly recipientsError = signal<string | null>(null);
  readonly isSending = signal(false);
  readonly showConfirmSend = signal(false);

  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = signal<string | null>(null);
  readonly liveAnnouncement = signal<string>('');

  // Pagination & Filtering
  readonly selectedStatusFilter = signal<RecipientStatus | ''>('');
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(20);
  readonly totalRecipients = signal<number>(0);
  readonly totalPages = signal<number>(1);
  readonly recipientQuery = signal('');
  readonly recipientSortBy = signal<'rowIndex' | 'email' | 'status' | 'createdAt' | 'updatedAt'>('rowIndex');
  readonly recipientSortDir = signal<'asc' | 'desc'>('asc');

  readonly retryingRecipientId = signal<string | null>(null);

  private pollIntervalId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const pid =
      this.route.snapshot.paramMap.get('projectId') ||
      this.route.parent?.snapshot.paramMap.get('projectId') ||
      '';
    const cid = this.route.snapshot.paramMap.get('campaignId') || '';

    this.projectId.set(pid);
    this.campaignId.set(cid);

    this.loadCampaign();
    this.loadRecipients();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  loadCampaign(silent = false): void {
    const pid = this.projectId();
    const cid = this.campaignId();
    if (!pid || !cid) return;

    if (!silent) {
      this.loading.set(true);
    }

    this.campaignsService.getCampaign(pid, cid).subscribe({
      next: (camp) => {
        const prevStatus = this.campaign()?.status;
        this.campaign.set(camp);
        this.loading.set(false);

        // Announce status change if status just changed
        if (prevStatus && prevStatus !== camp.status) {
          this.liveAnnouncement.set(`Campaign status changed to ${this.statusLabel(camp.status)}`);
        }

        // Manage polling based on status
        if (camp.status === 'sending') {
          this.startPolling();
        } else {
          this.stopPolling();
        }
      },
      error: () => {
        this.loading.set(false);
        this.actionError.set('Could not load campaign details.');
        this.stopPolling();
      },
    });
  }

  loadRecipients(): void {
    const pid = this.projectId();
    const cid = this.campaignId();
    if (!pid || !cid) return;

    this.loadingRecipients.set(true);
    this.recipientsError.set(null);
    const filter = this.selectedStatusFilter() || undefined;

    this.campaignsService
      .listRecipients(pid, cid, this.currentPage(), this.pageSize(), filter, this.recipientQuery(), this.recipientSortBy(), this.recipientSortDir())
      .subscribe({
        next: (page) => {
          this.recipients.set(page.data);
          this.loadingRecipients.set(false);
          this.totalRecipients.set(page.metadata.total);
          this.totalPages.set(Math.max(1, Math.ceil(page.metadata.total / (page.metadata.limit || this.pageSize()))));
        },
        error: () => {
          this.loadingRecipients.set(false);
          this.recipientsError.set('Failed to load recipients. Please try again.');
        },
      });
  }

  searchRecipients(query: string): void { this.recipientQuery.set(query); this.currentPage.set(1); this.loadRecipients(); }
  sortRecipients(event: Event): void { this.recipientSortBy.set((event.currentTarget as HTMLSelectElement).value as 'rowIndex' | 'email' | 'status' | 'createdAt' | 'updatedAt'); this.recipientSortDir.set(this.recipientSortDir() === 'asc' ? 'desc' : 'asc'); this.currentPage.set(1); this.loadRecipients(); }

  startPolling(): void {
    if (this.pollIntervalId !== null) return;

    this.pollIntervalId = setInterval(() => {
      this.loadCampaign(true);
      this.loadRecipients();
    }, 3000);
  }

  stopPolling(): void {
    if (this.pollIntervalId !== null) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  openSendConfirm(): void {
    this.showConfirmSend.set(true);
  }

  confirmSend(): void {
    const pid = this.projectId();
    const cid = this.campaignId();
    if (!pid || !cid || this.isSending()) return;

    this.isSending.set(true);
    this.actionError.set(null);
    this.actionSuccess.set(null);

    this.campaignsService.sendCampaign(pid, cid).subscribe({
      next: (result) => {
        this.isSending.set(false);
        this.showConfirmSend.set(false);
        this.actionSuccess.set(`Campaign is now sending (${result.enqueuedCount} recipients enqueued).`);
        this.liveAnnouncement.set('Campaign sending has started.');

        // Update local status and begin polling
        this.campaign.update((c) => (c ? { ...c, status: 'sending' } : null));
        this.startPolling();
      },
      error: (error: unknown) => {
        this.isSending.set(false);
        this.showConfirmSend.set(false);
        if (error instanceof ApiError && error.status === 409) {
          this.actionError.set('This campaign has already been sent or is currently sending.');
        } else if (error instanceof ApiError) {
          this.actionError.set(error.message || 'Failed to trigger campaign sending.');
        } else {
          this.actionError.set('Network error while triggering campaign send.');
        }
      },
    });
  }

  retryRecipient(recipientId: string): void {
    const pid = this.projectId();
    const cid = this.campaignId();
    if (!pid || !cid || this.retryingRecipientId()) return;

    this.retryingRecipientId.set(recipientId);
    this.actionError.set(null);

    this.campaignsService.retryRecipient(pid, cid, recipientId).subscribe({
      next: (updated) => {
        this.retryingRecipientId.set(null);
        this.recipients.update((list) =>
          list.map((r) => (r.id === updated.id ? { ...r, status: 'pending', errorMessage: null } : r)),
        );
        this.actionSuccess.set(`Recipient ${updated.email} re-enqueued for delivery.`);
        // Also update campaign status to sending if it was completed
        this.campaign.update((c) => (c ? { ...c, status: 'sending' } : null));
        this.startPolling();
      },
      error: (error: unknown) => {
        this.retryingRecipientId.set(null);
        if (error instanceof ApiError) {
          this.actionError.set(error.message || 'Failed to retry recipient delivery.');
        } else {
          this.actionError.set('Failed to retry recipient delivery.');
        }
      },
    });
  }

  onStatusFilterChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as RecipientStatus | '';
    this.selectedStatusFilter.set(value);
    this.currentPage.set(1);
    this.loadRecipients();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadRecipients();
  }

  badgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
      case 'completed':
        return 'default';
      case 'completed_with_errors':
      case 'failed':
        return 'destructive';
      case 'sending':
        return 'secondary';
      case 'draft':
      default:
        return 'outline';
    }
  }

  recipientBadgeVariant(status: RecipientStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
      case 'sent':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'pending':
      default:
        return 'secondary';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'sending':
        return 'Sending…';
      case 'completed':
        return 'Completed';
      case 'completed_with_errors':
        return 'Completed with errors';
      default:
        return status;
    }
  }

  navigateBack(event: Event): void {
    event.preventDefault();
    this.router.navigate(['/projects', this.projectId(), 'campaigns']);
  }
}
