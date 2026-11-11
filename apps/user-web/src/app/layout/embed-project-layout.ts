import { Component, OnInit, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { EmbedSessionService } from '../core/embed-session.service';
import type { EmbedScope } from '../core/embed-types';

type EmbedSection = { path: string; label: string; scopes: EmbedScope[] };
const sections: EmbedSection[] = [
  { path: 'templates', label: 'Templates', scopes: ['templates:read'] },
  { path: 'pdf-templates', label: 'PDF templates', scopes: ['templates:read'] },
  { path: 'data', label: 'Data', scopes: ['uploads:read', 'mappings:read'] },
  { path: 'campaigns', label: 'Campaigns', scopes: ['campaigns:read'] },
];

@Component({
  selector: 'app-embed-project-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <section class="mx-auto w-full max-w-screen-xl p-4 sm:p-6">
      <nav aria-label="Embedded project sections" class="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
        @for (section of visibleSections(); track section.path) {
          <a [routerLink]="['/embed/projects', projectId, section.path]" routerLinkActive="embed-section-active" [attr.aria-current]="isActive(section.path) ? 'page' : null" class="rounded-ui-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{{ section.label }}</a>
        }
      </nav>
      <router-outlet />
    </section>
  `,
  styles: [`.embed-section-active { background: var(--muted); text-decoration: underline; text-underline-offset: .25rem; }`],
})
export class EmbedProjectLayout implements OnInit {
  private readonly embed = inject(EmbedSessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
  protected readonly visibleSections = computed(() => sections.filter((section) => this.embed.hasScopes(section.scopes)));

  ngOnInit(): void {
    const current = this.router.url.split('?')[0] ?? '';
    if (current === `/embed/projects/${this.projectId}`) {
      const first = this.visibleSections()[0];
      if (first) void this.router.navigate(['/embed/projects', this.projectId, first.path], { replaceUrl: true });
    }
  }

  protected isActive(path: string): boolean {
    return this.router.url.split('?')[0]?.includes(`/projects/${this.projectId}/${path}`) ?? false;
  }
}
