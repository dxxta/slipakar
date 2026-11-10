import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { SegmentedTabs } from '../../ui/shared/segmented-tabs';
import type { TabItem } from '../../ui/shared/tabs';

@Component({
  imports: [RouterLink, RouterOutlet, SegmentedTabs],
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
            [items]="projectTabs"
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
export class ProjectDetailLayout {
  private readonly router = inject(Router);

  readonly projectTabs: TabItem[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'smtp', label: 'SMTP' },
    { id: 'templates', label: 'Templates' },
    { id: 'data', label: 'Data & Mapping' },
    { id: 'campaigns', label: 'Campaigns' },
    { id: 'pdf-templates', label: 'PDF Templates' },
  ];

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
    const found = this.projectTabs.find((t) => t.id === section);
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
