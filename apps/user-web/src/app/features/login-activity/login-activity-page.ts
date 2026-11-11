import { isPrivateIpAddress } from '@slipakar/ui/private-ip';
import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HlmBadge } from '../../ui/badge/src';
import { HlmButton } from '../../ui/button/src';
import { DataTableControls, Drawer, ListBody, PageHeader, Pagination, SelectControl } from '../../ui';
import { getMapView, MAP_MAX_ZOOM, MAP_MIN_ZOOM } from './map-tiles';
import { LoginActivityService, type LoginActivityItem, type LoginActivitySort } from './login-activity.service';
import { Ripple } from '../../ui/shared/ripple';

@Component({
  selector: 'app-login-activity-page',
  imports: [Ripple, 
    CommonModule,
    DatePipe,
    HlmBadge,
    HlmButton,
    DataTableControls,
    Drawer,
    ListBody,
    PageHeader,
    Pagination,
    SelectControl,
  ],
  template: `
    <app-page-header
      title="Login activity"
      badge="Account"
      [topLevel]="true"
      description="Recent sign-ins to your account and their best-effort location details."
    />
  <br/>
    <app-data-table-controls  [query]="query()" searchPlaceholder="Search login activity..." (queryChange)="search($event)">
      <div table-filters class="flex flex-wrap items-end gap-3">
        <label class="grid min-w-40 gap-1 text-xs font-medium text-muted-foreground">
          Sort by
          <select
            appSelect
            aria-label="Sort login activity"
            class="h-control-9 rounded-ui-md border border-input bg-background px-3 text-sm"
            [value]="sortBy()"
            (change)="sort($event)"
          >
            <option value="createdAt">Date</option>
            <option value="country">Location</option>
            <option value="browser">Browser</option>
            <option value="os">Operating system</option>
          </select>
        </label>
        <label class="grid min-w-32 gap-1 text-xs font-medium text-muted-foreground">
          Direction
          <select
            appSelect
            aria-label="Sort direction"
            class="h-control-9 rounded-ui-md border border-input bg-background px-3 text-sm"
            [value]="sortDir()"
            (change)="setDirection($event)"
          >
            <option value="desc">Newest</option>
            <option value="asc">Oldest</option>
          </select>
        </label>
      </div>
    </app-data-table-controls>

    <app-list-body
      class="mt-4"
      [state]="listState()"
      [itemCount]="events().length"
      [query]="query()"
      loadingLabel="Loading login activity"
      errorTitle="Could not load login activity"
      [errorMessage]="error() ?? 'Please try again.'"
      emptyTitle="No login activity yet"
      emptyMessage="New sign-ins will appear here."
      (retry)="load()"
      (clearQuery)="search('')"
    >
      <div list-content class="space-y-4">
        <div class="overflow-x-auto rounded-ui-lg border border-border bg-card">
          <table data-responsive class="min-w-[58rem] w-full text-left text-sm" aria-label="Login activity">
            <thead class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th class="px-4 py-3">Date</th>
                <th class="px-4 py-3">Device / browser</th>
                <th class="px-4 py-3">IP address</th>
                <th class="px-4 py-3">Proxy flag</th>
                <th class="px-4 py-3">Location</th>
                <th class="px-4 py-3">Map</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              @for (event of events(); track event.id) {
                <tr class="align-top hover:bg-muted/30">
                  <td data-label="Date" class="whitespace-nowrap px-4 py-4 tabular-nums">{{ event.createdAt | date: 'medium' }}</td>
                  <td data-label="Device / browser" class="px-4 py-4">
                    <p class="font-medium">{{ event.deviceType || 'Unknown device' }}</p>
                    <p class="mt-1 text-xs text-muted-foreground">
                      {{ event.browser || 'Unknown browser' }} · {{ event.os || 'Unknown OS' }}
                    </p>
                  </td>
                  <td data-label="IP address" class="px-4 py-4 font-mono text-xs tabular-nums">{{ event.ip || 'Unavailable' }}</td>
                  <td data-label="Proxy flag" class="px-4 py-4">
                    @if (event.proxy && !isPrivateIp(event.ip)) {
                      <span hlmBadge variant="outline" aria-label="Possible proxy (best effort)" title="best effort">
                        Possible proxy
                      </span>
                    } @else {
                      <span class="text-muted-foreground">No proxy signal</span>
                    }
                  </td>
                  <td data-label="Location" class="px-4 py-4">{{ locationLabel(event) }}</td>
                  <td data-label="Map" class="px-4 py-4">
                    @if (hasCoordinates(event)) {
                      <button
                        hlmBtn
                        variant="outline"
                        size="sm"
                        type="button"
                        [attr.aria-label]="'View map for ' + locationLabel(event)"
                        (click)="openMap(event)"
                      >
                        View map
                      </button>
                    } @else {
                      <span
                        class="text-xs text-muted-foreground"
                        [title]="
                          isPrivateIp(event.ip)
                            ? 'Private network addresses cannot be located'
                            : 'Location coordinates are unavailable'
                        "
                      >
                        No map
                      </span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </app-list-body>
    <app-pagination [metadata]="metadata()" (pageChange)="page.set($event); load()" />

    <app-drawer [open]="mapEvent() !== null" title="Login location map" (closed)="mapEvent.set(null)">
      @if (mapEvent(); as event) {
        <div class="flex h-[calc(100dvh-13rem)] min-h-80 flex-col gap-3">
          <p class="text-sm text-muted-foreground">{{ locationLabel(event) }}</p>
          <div
            class="relative min-h-0 flex-1 overflow-hidden rounded-ui-md border border-border bg-muted"
            role="img"
            [attr.aria-label]="'Map around ' + locationLabel(event)"
          >
            @if (mapView(); as view) {
              <div
                class="absolute"
                [style.width.px]="1792"
                [style.height.px]="1792"
                [style.left]="'calc(50% - ' + view.markerLeft + 'px)'"
                [style.top]="'calc(50% - ' + view.markerTop + 'px)'"
              >
                @for (tile of view.tiles; track tile.key) {
                  <img
                    [src]="tile.url"
                    alt=""
                    width="256"
                    height="256"
                    referrerpolicy="strict-origin-when-cross-origin"
                    class="absolute size-64 max-w-none"
                    [style.left.px]="tile.left"
                    [style.top.px]="tile.top"
                  />
                }
                <span
                  class="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#E5484D] shadow"
                  [style.left.px]="view.markerLeft"
                  [style.top.px]="view.markerTop"
                  aria-label="Login location marker"
                ></span>
              </div>
            }
            <div class="absolute right-3 top-3 flex flex-col gap-2">
              <button type="button" data-quiet-button data-pill class="size-9 text-lg leading-none" aria-label="Zoom in" [disabled]="mapZoom() >= maxZoom" (click)="zoomMap(1)">+</button>
              <button type="button" data-quiet-button data-pill class="size-9 text-lg leading-none" aria-label="Zoom out" [disabled]="mapZoom() <= minZoom" (click)="zoomMap(-1)">−</button>
            </div>
          </div>
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-muted-foreground underline"
          >
            © OpenStreetMap contributors
          </a>
        </div>
      }
    </app-drawer>
  `,
})
export class LoginActivityPage implements OnInit {
  private readonly service = inject(LoginActivityService);
  readonly events = signal<LoginActivityItem[]>([]);
  readonly metadata = signal({ page: 1, limit: 20, total: 0 });
  readonly page = signal(1);
  readonly query = signal('');
  readonly sortBy = signal<LoginActivitySort>('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly mapEvent = signal<LoginActivityItem | null>(null);
  readonly minZoom = MAP_MIN_ZOOM;
  readonly maxZoom = MAP_MAX_ZOOM;
  readonly mapZoom = signal(10);
  readonly mapView = computed(() => {
    const event = this.mapEvent();
    return event && this.hasCoordinates(event) ? getMapView(event.latitude!, event.longitude!, this.mapZoom()) : null;
  });
  zoomMap(delta: number): void {
    this.mapZoom.update((zoom) => Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, zoom + delta)));
  }

  readonly listState = computed(() =>
    this.loading() ? 'loading' : this.error() ? 'error' : 'ready'
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service
      .list({
        page: this.page(),
        limit: 20,
        q: this.query(),
        sortBy: this.sortBy(),
        sortDir: this.sortDir(),
      })
      .subscribe({
        next: (result) => {
          this.events.set(result.data);
          this.metadata.set(result.metadata);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Please try again.');
          this.loading.set(false);
        },
      });
  }

  search(value: string): void {
    this.query.set(value);
    this.page.set(1);
    this.load();
  }

  sort(event: Event): void {
    this.sortBy.set((event.currentTarget as HTMLSelectElement).value as LoginActivitySort);
    this.page.set(1);
    this.load();
  }

  setDirection(event: Event): void {
    this.sortDir.set((event.currentTarget as HTMLSelectElement).value as 'asc' | 'desc');
    this.page.set(1);
    this.load();
  }

  hasCoordinates(event: LoginActivityItem): boolean {
    return event.latitude !== null && event.longitude !== null;
  }

  isPrivateIp(ip: string | null): boolean {
    return isPrivateIpAddress(ip);
  }

  locationLabel(event: LoginActivityItem): string {
    const location = [event.city, event.region, event.country].filter((part): part is string => Boolean(part)).join(', ');
    return location || (this.isPrivateIp(event.ip) ? 'Local network' : 'Unknown location');
  }

  openMap(event: LoginActivityItem): void {
    if (this.hasCoordinates(event)) {
      this.mapZoom.set(10);
      this.mapEvent.set(event);
    }
  }
}
