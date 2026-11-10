import { CommonModule } from '@angular/common';
import { SelectControl } from '../../ui/shared/select-control';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerCheck, tablerInfoCircle } from '@ng-icons/tabler-icons';
import { ApiClient } from '../../core/api-client';
import { UnreadNotificationsStore } from '../../core/unread-notifications.store';
import { DataTableControls } from '../../ui/shared/data-table-controls';
import { Pagination } from '../../ui/shared/pagination';
import { HlmBadge } from '../../ui/badge/src';
import { HlmButton } from '../../ui/button/src';
import { ListBody, PageHeader, SegmentedTabs, type TabItem } from '../../ui';
import { type NotificationItem, NotificationsService } from './notifications.service';
import { type UserNoticeItem, UserNoticesService } from './user-notices.service';
import { Ripple } from '../../ui/shared/ripple';

interface Project {
  id: string;
  name: string;
}

@Component({
  selector: 'app-notifications-page',
  imports: [Ripple, 
    SelectControl,
    CommonModule,
    HlmButton,
    HlmBadge,
    DataTableControls,
    ListBody,
    PageHeader,
    Pagination,
    SegmentedTabs,
    NgIcon,
  ],
  providers: [provideIcons({ tablerCheck, tablerAlertTriangle, tablerInfoCircle })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Notifications"
      badge="Account"
      [topLevel]="true"
      description="Activity, status updates, and campaign completion events."
    >
      @if (projects().length > 1) {
        <div page-actions class="flex items-center gap-2">
          <label for="project-select" class="text-xs text-muted-foreground">Project:</label>
          <select
            appSelect
            id="project-select"
            class="h-control-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            [value]="selectedProjectId()"
            (change)="onProjectChange($event)"
          >
            @for (proj of projects(); track proj.id) {
              <option [value]="proj.id">{{ proj.name }}</option>
            }
          </select>
        </div>
      }
    </app-page-header>
      <br/>
    <app-segmented-tabs 
      ariaLabel="Notification categories"
      [items]="categoryTabs"
      [selected]="activeTab()"
      (selectedChange)="setTab($any($event))"
    />

    <app-data-table-controls class="mt-4 !mb-0" [query]="searchQuery()" searchPlaceholder="Search notifications..." (queryChange)="onSearch($event)">
      <div table-filters class="flex flex-wrap items-end gap-3">
        <label class="grid min-w-40 gap-1 text-xs font-medium text-muted-foreground">
          Sort notifications
          <select
            appSelect
            aria-label="Sort notifications"
            class="h-control-9 rounded-ui-md border border-input bg-background px-3 text-sm"
            [value]="sortBy()"
            (change)="onSort($event)"
          >
            <option value="createdAt">Date</option>
            <option value="type">Type</option>
            <option value="readAt">Read status</option>
          </select>
        </label>
        <label class="flex h-control-9 items-center gap-2 whitespace-nowrap text-sm">
          <input
            type="checkbox"
            aria-label="Unread only"
            [checked]="unreadOnly()"
            (change)="onUnreadOnlyChange($event)"
          />
          Unread only
        </label>
        @if (activeTab() === 'activity') {
          <button
            hlmBtn
            type="button"
            variant="outline"
            [disabled]="!hasUnreadNotifications()"
            (click)="markAllRead()"
          >
            Mark all as read
          </button>
        } @else {
          <button
            hlmBtn
            type="button"
            variant="outline"
            aria-label="Mark all announcements as read"
            [disabled]="!hasUnreadNotices()"
            (click)="markAllNoticesRead()"
          >
            Mark all as read
          </button>
        }
      </div>
    </app-data-table-controls>

    <br/>

    @if (actionError()) {
      <div
        role="alert"
        aria-label="Notification update error"
        class="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
      >
        {{ actionError() }}
      </div>
        <br/>
    }

    @if (activeTab() === 'announcements') {
      <section aria-label="Announcements">
        <app-list-body
          [state]="noticeLoading() ? 'loading' : noticeError() ? 'error' : 'ready'"
          [itemCount]="notices().length"
          [query]="searchQuery()"
          loadingLabel="Loading announcements"
          errorTitle="Could not load announcements"
          [errorMessage]="noticeError() ?? ''"
          emptyTitle="No announcements yet"
          emptyMessage="Workspace announcements will appear here."
          (retry)="loadNotices()"
          (clearQuery)="onSearch('')"
        >
          <div list-content class="space-y-4">
            <div class="overflow-hidden rounded-ui-lg border border-border bg-card">
              <ul aria-label="Workspace announcements" class="divide-y divide-border">
                @for (notice of notices(); track notice.id) {
                  <li
                    class="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
                    [ngClass]="{ 'bg-primary/5': !notice.readAt }"
                  >
                    <div class="flex min-w-0 items-start gap-3">
                      @if (!notice.readAt) {
                        <span
                          role="img"
                          aria-label="Unread announcement"
                          class="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                        ></span>
                      }
                      <div class="min-w-0">
                        <h3 class="font-medium break-words">{{ notice.title }}</h3>
                        <p class="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{{ notice.message }}</p>
                        <time
                          class="mt-2 block text-xs text-muted-foreground tabular-nums"
                          [attr.datetime]="notice.createdAt"
                        >
                          {{ notice.createdAt | date: 'medium' }}
                        </time>
                      </div>
                    </div>
                    @if (!notice.readAt) {
                      <button
                        hlmBtn
                        type="button"
                        variant="ghost"
                        size="sm"
                        [attr.aria-label]="'Mark announcement as read: ' + notice.title"
                        (click)="markNoticeRead(notice)"
                      >
                        Mark as read
                      </button>
                    }
                  </li>
                }
              </ul>
            </div>
          </div>
        </app-list-body>
        <app-pagination [metadata]="noticeMetadata()" (pageChange)="loadNotices($event)" />
      </section>
    } @else {
      <!-- Activity tab -->
      <app-list-body
        class="mt-4"
        [state]="loading() ? 'loading' : error() ? 'error' : 'ready'"
        [itemCount]="notifications().length"
        [query]="searchQuery()"
        loadingLabel="Loading notifications"
        errorTitle="Could not load notifications"
        [errorMessage]="error() ?? ''"
        emptyTitle="You are all caught up"
        emptyMessage="No notifications yet for this project. Activity will appear here when campaigns run."
        (retry)="retry()"
        (clearQuery)="onSearch('')"
      >
        <div list-content class="space-y-4">
          <div class="overflow-hidden rounded-lg border border-border bg-card">
            <ul class="divide-y divide-border" aria-label="Notifications list">
              @for (item of notifications(); track item.id) {
                <li
                  class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/40 transition-colors"
                  [ngClass]="{ 'bg-primary/5': !item.readAt }"
                  [attr.data-testid]="'notification-item-' + item.id"
                >
                  <div class="flex items-start gap-3 min-w-0">
                    @if (!item.readAt) {
                      <span
                        role="img"
                        aria-label="Unread notification"
                        class="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                      ></span>
                    }
                    <div class="mt-0.5 shrink-0" aria-hidden="true">
                      @if (item.type === 'campaign_finished') {
                        <span
                          class="flex size-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        >
                          <ng-icon name="tablerCheck" class="size-4" />
                        </span>
                      } @else if (item.type === 'send_failed') {
                        <span
                          class="flex size-8 items-center justify-center rounded-full bg-destructive/10 text-destructive"
                        >
                          <ng-icon name="tablerAlertTriangle" class="size-4" />
                        </span>
                      } @else {
                        <span
                          class="flex size-8 items-center justify-center rounded-full bg-primary/10 text-foreground"
                        >
                          <ng-icon name="tablerInfoCircle" class="size-4" />
                        </span>
                      }
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <span hlmBadge [variant]="badgeVariant(item.type)" class="text-xs">
                          {{ typeLabel(item.type) }}
                        </span>
                        <time
                          class="text-xs text-muted-foreground tabular-nums"
                          [attr.datetime]="item.createdAt"
                          [attr.title]="item.createdAt"
                        >
                          {{ formatRelativeTime(item.createdAt) }}
                        </time>
                      </div>
                      <p class="mt-1.5 text-sm text-foreground break-words">{{ item.message }}</p>
                    </div>
                  </div>

                  @if (item.campaignId) {
                    <div class="shrink-0 self-start sm:self-center">
                      <a
                        hlmBtn
                        variant="outline"
                        size="sm"
                        data-testid="campaign-link"
                        [href]="'/projects/' + (selectedProjectId() || item.projectId) + '/campaigns/' + item.campaignId"
                        (click)="navigateToCampaign($event, selectedProjectId() || item.projectId, item.campaignId)"
                      >
                        View campaign
                      </a>
                    </div>
                  }
                  @if (!item.readAt) {
                    <button
                      hlmBtn
                      type="button"
                      variant="ghost"
                      size="sm"
                      [attr.aria-label]="'Mark as read: ' + item.message"
                      (click)="markRead(item)"
                    >
                      Mark as read
                    </button>
                  }
                </li>
              }
            </ul>
          </div>

        </div>
      </app-list-body>
      <app-pagination
        [metadata]="{ page: currentPage(), limit: pageSize(), total: totalItems() }"
        (pageChange)="onPageChange($event)"
      />
    }
  `,
})
export class NotificationsPage implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly notificationsService = inject(NotificationsService);
  private readonly router = inject(Router);
  private readonly unreadNotificationsStore = inject(UnreadNotificationsStore);
  private readonly userNoticesService = inject(UserNoticesService);

  readonly categoryTabs: TabItem[] = [
    { id: 'activity', label: 'Activity' },
    { id: 'announcements', label: 'Announcements' },
  ];

  readonly projects = signal<Project[]>([]);
  readonly selectedProjectId = signal<string>('');
  readonly notifications = signal<NotificationItem[]>([]);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly unreadOnly = signal(false);
  readonly searchQuery = signal('');
  readonly sortBy = signal<'type' | 'createdAt' | 'readAt'>('createdAt');

  readonly currentPage = signal(1);
  readonly totalItems = signal(0);
  readonly pageSize = signal(20);
  readonly activeTab = signal<'activity' | 'announcements'>('activity');
  readonly notices = signal<UserNoticeItem[]>([]);
  readonly noticeMetadata = signal({ page: 1, limit: 20, total: 0 });
  readonly noticeLoading = signal(false);
  readonly noticeError = signal<string | null>(null);

  ngOnInit(): void {
    this.init();
  }

  private init(): void {
    this.loading.set(true);
    this.api
      .getPage<Project>('/projects?page=1&limit=100&sortBy=createdAt&sortDir=desc')
      .subscribe({
        next: (res) => {
          this.projects.set(res.data);
          if (res.data.length > 0) {
            this.selectedProjectId.set(res.data[0].id);
            this.loadNotifications();
          } else {
            this.loading.set(false);
          }
        },
        error: () => {
          this.error.set('Failed to load projects');
          this.loading.set(false);
        },
      });
  }

  setTab(tab: 'activity' | 'announcements'): void {
    this.activeTab.set(tab);
    if (tab === 'announcements' && !this.notices().length && !this.noticeLoading()) {
      this.loadNotices();
    }
  }

  loadNotices(page = 1): void {
    this.noticeLoading.set(true);
    this.noticeError.set(null);
    this.userNoticesService.list(page, 20).subscribe({
      next: (res) => {
        this.notices.set(res.data);
        this.noticeMetadata.set(res.metadata);
        this.noticeLoading.set(false);
      },
      error: () => {
        this.noticeError.set('Could not load announcements. Please try again.');
        this.noticeLoading.set(false);
      },
    });
  }

  hasUnreadNotices(): boolean {
    return this.notices().some((notice) => !notice.readAt);
  }

  markNoticeRead(notice: UserNoticeItem): void {
    const previous = this.notices();
    this.notices.update((items) =>
      items.map((item) =>
        item.id === notice.id ? { ...item, readAt: new Date().toISOString() } : item
      )
    );
    this.actionError.set(null);

    this.userNoticesService.markRead(notice.id).subscribe({
      next: () => {
        this.unreadNotificationsStore.refresh();
      },
      error: () => {
        this.notices.set(previous);
        this.actionError.set('Could not mark announcement as read. Please try again.');
      },
    });
  }

  markAllNoticesRead(): void {
    const previous = this.notices();
    const unread = previous.filter((notice) => !notice.readAt);
    if (!unread.length) return;

    this.notices.update((items) =>
      items.map((item) => ({
        ...item,
        readAt: item.readAt ?? new Date().toISOString(),
      }))
    );
    this.actionError.set(null);

    this.userNoticesService.markAllRead().subscribe({
      next: () => {
        this.unreadNotificationsStore.refresh();
      },
      error: () => {
        this.notices.set(previous);
        this.actionError.set('Could not mark all announcements as read. Please try again.');
      },
    });
  }

  loadNotifications(): void {
    const projId = this.selectedProjectId();
    if (!projId) return;

    this.loading.set(true);
    this.error.set(null);

    this.notificationsService
      .listNotifications(
        projId,
        this.currentPage(),
        this.pageSize(),
        this.unreadOnly(),
        this.searchQuery().trim(),
        this.sortBy(),
        'desc'
      )
      .subscribe({
        next: (res) => {
          this.notifications.set(res.data);
          this.totalItems.set(res.metadata.total);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to load notifications');
          this.loading.set(false);
        },
      });
  }

  retry(): void {
    if (!this.selectedProjectId() && this.projects().length === 0) {
      this.init();
    } else {
      this.loadNotifications();
    }
  }

  onProjectChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedProjectId.set(select.value);
    this.currentPage.set(1);
    this.loadNotifications();
  }

  onSearch(query: string): void {
    this.searchQuery.set(query);
    this.currentPage.set(1);
    this.loadNotifications();
  }

  onSort(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.sortBy.set(select.value as 'type' | 'createdAt' | 'readAt');
    this.currentPage.set(1);
    this.loadNotifications();
  }

  onUnreadOnlyChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.unreadOnly.set(input.checked);
    this.currentPage.set(1);
    this.loadNotifications();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadNotifications();
  }

  hasUnreadNotifications(): boolean {
    return this.notifications().some((n) => !n.readAt);
  }

  markRead(item: NotificationItem): void {
    const projId = this.selectedProjectId() || item.projectId;
    const previous = this.notifications();

    this.notifications.update((items) =>
      items.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n))
    );
    this.actionError.set(null);

    this.notificationsService.markRead(projId, item.id).subscribe({
      next: () => {
        this.unreadNotificationsStore.refresh();
      },
      error: () => {
        this.notifications.set(previous);
        this.actionError.set('Could not mark notification as read');
      },
    });
  }

  markAllRead(): void {
    const projId = this.selectedProjectId();
    if (!projId) return;

    const previous = this.notifications();
    this.notifications.update((items) =>
      items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
    );
    this.actionError.set(null);

    this.notificationsService.markAllRead(projId).subscribe({
      next: () => {
        this.unreadNotificationsStore.refresh();
      },
      error: () => {
        this.notifications.set(previous);
        this.actionError.set('Could not mark all notifications as read');
      },
    });
  }

  navigateToCampaign(event: MouseEvent, projectId: string, campaignId: string): void {
    event.preventDefault();
    void this.router.navigate(['/projects', projectId, 'campaigns', campaignId]);
  }

  badgeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (type) {
      case 'campaign_finished':
        return 'secondary';
      case 'send_failed':
        return 'destructive';
      case 'system_alert':
        return 'default';
      default:
        return 'outline';
    }
  }

  typeLabel(type: string): string {
    switch (type) {
      case 'campaign_finished':
        return 'Campaign Finished';
      case 'send_failed':
        return 'Send Failed';
      case 'system_alert':
        return 'System Alert';
      case 'limit_warning':
        return 'Limit Warning';
      default:
        return type;
    }
  }

  formatRelativeTime(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return 'just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }
}
