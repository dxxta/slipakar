import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom, map } from 'rxjs';
import { SegmentedTabs } from '../../ui/shared/segmented-tabs';
import type { TabItem } from '../../ui/shared/tabs';
import { Ripple } from '../../ui/shared/ripple';
import { ApiClient } from '../../core/api-client';

@Component({
  imports: [Ripple, RouterLink, RouterOutlet, SegmentedTabs],
  selector: 'app-project-detail-layout',
  template: `
    <section>
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <a
          routerLink="/projects"
          class="-ml-2 inline-flex h-control-9 shrink-0 items-center rounded-ui-sm px-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← All projects
        </a>
        <div class="min-w-0 max-w-full overflow-x-auto">
          <app-segmented-tabs
            ariaLabel="Project sections"
            [items]="projectTabs()"
            [selected]="activeTab()"
            (selectedChange)="onTabSelect($event)"
          />
        </div>
      </div>

      <div class="pt-7">
        <router-outlet />
      </div>
    </section>
  `,
})
export class ProjectDetailLayout implements OnInit {
  private readonly router = inject(Router);
  private readonly api = inject(ApiClient);
  readonly apiAccessActive = signal(false);
  ngOnInit(): void { void firstValueFrom(this.api.get<{ active: boolean }>('/me/api-access')).then((result) => this.apiAccessActive.set(result.active)).catch(() => this.apiAccessActive.set(false)); }

  readonly baseProjectTabs: TabItem[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'smtp', label: 'SMTP' },
    { id: 'templates', label: 'Templates' },
    { id: 'data', label: 'Data & Mapping' },
    { id: 'campaigns', label: 'Campaigns' },
    { id: 'pdf-templates', label: 'PDF Templates' },
  ];

  readonly projectTabs = computed(() => this.apiAccessActive() ? [...this.baseProjectTabs, { id: 'api-keys', label: 'API keys' }] : this.baseProjectTabs);

  private readonly urlSignal = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  readonly activeTab = computed(() => {
    const url = this.urlSignal();
    const match = url.match(/\/projects\/[^/]+\/([^/?#]+)/);
    const section = match ? match[1] : 'overview';
    const found = this.projectTabs().find((t) => t.id === section);
    return found ? found.id : 'overview';
  });

  onTabSelect(tabId: string): void {
    const currentUrl = this.router.url;
    const match = currentUrl.match(/\/projects\/([^/?#]+)/);
    const projectId = match ? match[1] : '';
    if (projectId) {
      void this.router.navigate(['/projects', projectId, tabId]);
    } else {
      void this.router.navigate([tabId]);
    }
  }
}
