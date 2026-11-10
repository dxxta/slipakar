import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerExternalLink, tablerRefresh } from '@ng-icons/tabler-icons';
import { HlmBadge } from '../../ui/badge/src/lib/hlm-badge';
import { HlmButton } from '../../ui/button/src/lib/hlm-button';
import {
  HlmCard,
  HlmCardAction,
  HlmCardContent,
  HlmCardDescription,
  HlmCardHeader,
  HlmCardTitle,
} from '../../ui/card/src';
import { getMonitoringLinks, type MonitoringServiceLink } from './monitoring-links';
import { PageHeader } from '../../ui/shared/page-header';
import { Ripple } from '../../ui/shared/ripple';

export type HealthStatus = 'loading' | 'healthy' | 'unreachable';

@Component({
  selector: 'app-monitoring-page',
  imports: [Ripple, 
    DatePipe,
    HlmBadge,
    HlmButton,
    HlmCard,
    HlmCardAction,
    HlmCardContent,
    HlmCardDescription,
    HlmCardHeader,
    HlmCardTitle,
    PageHeader,
    NgIcon,
  ],
  providers: [provideIcons({ tablerExternalLink, tablerRefresh })],
  template: `
    <div class="space-y-10">
      <app-page-header
        title="Monitoring"
        description="Service endpoints, telemetry dashboards, and live API health status."
        badge="Admin"
        [topLevel]="true"
      />

      <!-- Section 1: Services -->
      <section aria-labelledby="services-title" class="space-y-4">
        <div>
          <h2 id="services-title" class="text-xl font-semibold tracking-tight">Services</h2>
          <p class="text-sm text-muted-foreground">
            External monitoring tools and API documentation resources.
          </p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          @for (service of services; track service.id) {
            <div hlmCard class="justify-between">
              <div hlmCardHeader>
                <h3 hlmCardTitle>{{ service.title }}</h3>
                <p hlmCardDescription>{{ service.description }}</p>
                <div hlmCardAction>
                  <a
                    hlmBtn
                    variant="outline"
                    size="sm"
                    [href]="service.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    [attr.aria-label]="service.buttonLabel"
                  >
                    Open
                    <ng-icon name="tablerExternalLink" class="ml-1 size-3.5" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
          }
        </div>
      </section>

      <!-- Section 2: API health -->
      <section aria-labelledby="health-title" class="space-y-4">
        <div>
          <h2 id="health-title" class="text-xl font-semibold tracking-tight">API health</h2>
          <p class="text-sm text-muted-foreground">
            Live heartbeat verification of the backend API service.
          </p>
        </div>

        <div hlmCard>
          <div hlmCardHeader>
            <h3 hlmCardTitle class="flex items-center gap-2">
              Slipakar API
              <span aria-live="polite">
                @switch (healthStatus()) {
                  @case ('healthy') {
                    <span hlmBadge class="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" data-testid="health-badge">
                      <span class="mr-1.5 inline-block size-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
                      Healthy
                    </span>
                  }
                  @case ('unreachable') {
                    <span hlmBadge variant="destructive" data-testid="health-badge">
                      <span class="mr-1.5 inline-block size-2 rounded-full bg-destructive" aria-hidden="true"></span>
                      Unreachable
                    </span>
                  }
                  @case ('loading') {
                    <span hlmBadge variant="secondary" data-testid="health-badge">
                      Checking...
                    </span>
                  }
                }
              </span>
            </h3>
            <p hlmCardDescription>
              Endpoint: <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">/health</code>
            </p>
            <div hlmCardAction>
              <button
                hlmBtn
                variant="outline"
                size="sm"
                type="button"
                data-testid="refresh-btn"
                (click)="checkHealth()"
                [disabled]="isChecking()"
                aria-label="Refresh API health status"
              >
                <ng-icon
                  name="tablerRefresh"
                  class="mr-1.5 size-3.5"
                  [class.animate-spin]="isChecking()"
                  aria-hidden="true"
                />
                Refresh
              </button>
            </div>
          </div>
          <div hlmCardContent>
            <p class="text-xs text-muted-foreground tabular-nums" data-testid="last-checked">
              @if (lastChecked(); as date) {
                Last checked: {{ date | date: 'medium' }}
              } @else {
                Not checked yet
              }
            </p>
          </div>
        </div>
      </section>
    </div>
  `,
})
export class MonitoringPage implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);

  protected readonly services: readonly MonitoringServiceLink[] = getMonitoringLinks();
  protected readonly healthStatus = signal<HealthStatus>('loading');
  protected readonly lastChecked = signal<Date | null>(null);
  protected readonly isChecking = signal(false);

  private pollIntervalId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.checkHealth();
    this.pollIntervalId = setInterval(() => {
      this.checkHealth();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.pollIntervalId !== null) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  checkHealth(): void {
    this.isChecking.set(true);
    this.http.get<{ status: string }>('/health').subscribe({
      next: (res) => {
        this.isChecking.set(false);
        this.lastChecked.set(new Date());
        if (res && res.status === 'ok') {
          this.healthStatus.set('healthy');
        } else {
          this.healthStatus.set('unreachable');
        }
      },
      error: () => {
        this.isChecking.set(false);
        this.lastChecked.set(new Date());
        this.healthStatus.set('unreachable');
      },
    });
  }
}
