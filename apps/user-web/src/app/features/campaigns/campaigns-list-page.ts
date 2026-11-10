import { CommonModule } from '@angular/common';
import { SelectControl } from '../../ui/shared/select-control';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HlmBadge } from '../../ui/badge/src';
import { HlmButton } from '../../ui/button/src';
import { DataTableControls } from '../../ui/shared/data-table-controls';
import { ListBody } from '../../ui/shared/list-body';
import { PageHeader } from '../../ui/shared/page-header';
import { Pagination } from '../../ui/shared/pagination';
import { RowActions, RowActionItem } from '../../ui/shared/row-actions';
import { type PageMetadata } from '../../core/api-client';
import {
  type CampaignDetail,
  type CampaignItem,
  CampaignsService,
} from './campaigns.service';
import { Ripple } from '../../ui/shared/ripple';

@Component({
  selector: 'app-campaigns-list-page',
  imports: [Ripple, 
    RowActions,
    SelectControl, CommonModule, HlmButton, HlmBadge, DataTableControls, ListBody, PageHeader, Pagination],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-list-layout">
      <app-page-header title="Campaigns" description="Manage and track bulk personalized email campaigns." [topLevel]="false">
        <button
          page-actions
          hlmBtn
          type="button"
          class="max-md:hidden"
          data-testid="create-campaign-button"
          (click)="navigateToCreate()"
        >
          New campaign
        </button>
        <app-row-actions page-actions class="md:hidden" [solid]="true" label="Page actions" [items]="pageActions" (actionSelect)="navigateToCreate()" />
      </app-page-header>
      <app-data-table-controls [query]="query()" searchPlaceholder="Search campaigns..." (queryChange)="search($event)"><div table-filters><label class="grid min-w-40 gap-1 text-xs font-medium text-muted-foreground">Sort campaigns
        <select appSelect aria-label="Sort campaigns" class="h-control-9 rounded-ui-md border border-input bg-background px-3 text-sm" [value]="sortBy()" (change)="sort($event)"><option value="createdAt">Created</option><option value="updatedAt">Updated</option><option value="status">Status</option></select>
      </label></div></app-data-table-controls>

      <app-list-body [state]="loading() ? 'loading' : error() ? 'error' : 'ready'" [itemCount]="campaigns().length" [query]="query()" errorTitle="Could not load campaigns" [errorMessage]="error() ?? ''" emptyTitle="No campaigns yet" emptyMessage="Create your first campaign by selecting a template, data upload, and SMTP connection." emptyResultLabel="No campaigns match" (retry)="loadCampaigns()" (clearQuery)="search('')">
        <div list-content class="overflow-x-auto rounded-lg border border-border bg-card">
          <table data-responsive class="min-w-[44rem] w-full text-left text-sm" aria-label="Campaigns list">
            <thead class="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase">
              <tr>
                <th scope="col" class="px-6 py-3">Campaign</th>
                <th scope="col" class="px-6 py-3">Status</th>
                <th scope="col" class="px-6 py-3">Progress</th>
                <th scope="col" class="px-6 py-3">Created</th>
                <th scope="col" class="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              @for (campaign of campaigns(); track campaign.id) {
                <tr class="hover:bg-muted/50 transition-colors" [attr.data-testid]="'campaign-row-' + campaign.id">
                  <td data-label="Campaign" class="px-6 py-4 font-medium">
                    <a
                      [href]="'/projects/' + projectId() + '/campaigns/' + campaign.id"
                      class="text-primary hover:underline tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      (click)="navigateToDetail($event, campaign.id)"
                    >
                      Campaign #{{ campaign.id.slice(0, 8) }}
                    </a>
                    <p class="text-xs text-muted-foreground mt-0.5 tabular-nums">
                      Template: {{ campaign.emailTemplateId.slice(0, 8) }} · Upload: {{ campaign.uploadId.slice(0, 8) }}
                    </p>
                  </td>
                  <td data-label="Status" class="px-6 py-4">
                    <span
                      hlmBadge
                      [variant]="badgeVariant(campaign.status)"
                      [attr.data-testid]="'status-badge-' + campaign.id"
                    >
                      {{ statusLabel(campaign.status) }}
                    </span>
                  </td>
                  <td data-label="Progress" class="px-6 py-4 text-xs tabular-nums">
                    @if (campaignCounts()[campaign.id]; as counts) {
                      <span [attr.data-testid]="'counts-' + campaign.id">
                        <span class="text-green-700 dark:text-green-300 font-medium">{{ counts.sent }} sent</span>
                        @if (counts.failed > 0) {
                          · <span class="text-destructive font-medium">{{ counts.failed }} failed</span>
                        }
                        · <span class="text-muted-foreground">{{ counts.total }} total</span>
                      </span>
                    } @else {
                      <span class="text-muted-foreground">—</span>
                    }
                  </td>
                  <td data-label="Created" class="px-6 py-4 text-xs text-muted-foreground tabular-nums">
                    {{ campaign.createdAt | date: 'mediumDate' }}
                  </td>
                  <td data-label="Actions" class="px-6 py-4 text-right"><app-row-actions [attr.data-testid]="'campaign-actions-' + campaign.id" [label]="'Actions for campaign ' + campaign.id.slice(0, 8)" [items]="campaignActions" (actionSelect)="navigateToDetail(null, campaign.id)" /></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <button empty-action hlmBtn class="mt-5" type="button" data-testid="empty-create-button" (click)="navigateToCreate()">Create your first campaign</button>
      </app-list-body>
      <app-pagination [metadata]="metadata()" (pageChange)="setPage($event)" />
    </div>
  `,
})
export class CampaignsListPage implements OnInit {
  protected readonly pageActions: RowActionItem[] = [{ id: 'new', label: 'New campaign', icon: 'plus' }];
  protected readonly campaignActions: RowActionItem[] = [{ id: 'view', label: 'View', icon: 'eye' }];
  private readonly campaignsService = inject(CampaignsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly projectId = signal<string>('');
  readonly campaigns = signal<CampaignItem[]>([]);
  readonly campaignCounts = signal<Record<string, { sent: number; failed: number; total: number }>>({});
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly query = signal('');
  readonly metadata = signal<PageMetadata>({ page: 1, limit: 20, total: 0 });
  readonly sortBy = signal<'status' | 'createdAt' | 'updatedAt'>('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');

  ngOnInit(): void {
    const pid =
      this.route.snapshot.paramMap.get('projectId') ||
      this.route.parent?.snapshot.paramMap.get('projectId') ||
      '';
    this.projectId.set(pid);
    this.loadCampaigns();
  }

  loadCampaigns(): void {
    const pid = this.projectId();
    if (!pid) return;

    this.loading.set(true);
    this.error.set(null);

    this.campaignsService.listCampaigns(pid, this.metadata().page, 20, this.query(), this.sortBy(), this.sortDir()).subscribe({
      next: (response) => {
        const data = response.data;
        this.metadata.set(response.metadata);
        this.campaigns.set(data);
        this.loading.set(false);
        // Fetch detailed counts for each campaign
        for (const camp of data) {
          this.campaignsService.getCampaign(pid, camp.id).subscribe({
            next: (detail: CampaignDetail) => {
              this.campaignCounts.update((prev) => ({
                ...prev,
                [camp.id]: detail.counts,
              }));
            },
            error: () => {},
          });
        }
      },
      error: () => {
        this.error.set('Failed to load campaigns. Please try again.');
        this.loading.set(false);
      },
    });
  }

  search(query: string): void { this.query.set(query); this.metadata.update((value) => ({ ...value, page: 1 })); this.loadCampaigns(); }
  setPage(page: number): void { this.metadata.update((value) => ({ ...value, page })); this.loadCampaigns(); }
  sort(event: Event): void { this.sortBy.set((event.currentTarget as HTMLSelectElement).value as 'status' | 'createdAt' | 'updatedAt'); this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc'); this.metadata.update((value) => ({ ...value, page: 1 })); this.loadCampaigns(); }

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

  navigateToCreate(): void {
    this.router.navigate(['/projects', this.projectId(), 'campaigns', 'new']);
  }

  navigateToDetail(event: Event | null, campaignId: string): void {
    if (event) {
      event.preventDefault();
    }
    this.router.navigate(['/projects', this.projectId(), 'campaigns', campaignId]);
  }
}
