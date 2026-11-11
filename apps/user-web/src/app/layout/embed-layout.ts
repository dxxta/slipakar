import { DOCUMENT } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { EmbedSessionService } from '../core/embed-session.service';

@Component({
  selector: 'app-embed-layout',
  imports: [RouterOutlet],
  template: `
    <main #content class="min-h-dvh bg-background text-foreground">
      @if (embed.state() === 'ready') {
        @if (hasAvailableSection()) { <router-outlet /> }
        @else { <section class="grid min-h-dvh place-items-center p-6 text-center" role="status"><p class="text-sm text-muted-foreground">This embed session has no sections enabled.</p></section> }
      } @else {
        <section class="grid min-h-dvh place-items-center p-6 text-center" aria-live="polite">
          <div class="max-w-md space-y-3">
            <h1 class="text-xl font-semibold">{{ statusTitle() }}</h1>
            <p class="text-sm text-muted-foreground">{{ statusMessage() }}</p>
          </div>
        </section>
      }
    </main>
  `,
})
export class EmbedLayout implements OnInit, AfterViewInit, OnDestroy {
  protected readonly embed = inject(EmbedSessionService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  @ViewChild('content') private content?: ElementRef<HTMLElement>;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => this.navigateToDefaultSection());
  }

  ngOnInit(): void {
    this.navigateToDefaultSection();
  }

  private navigateToDefaultSection(): void {
    const session = this.embed.session();
    if (this.embed.state() !== 'ready' || !session || this.router.url.split('?')[0] !== '/embed') return;
    const sections = [
      { path: 'templates', scopes: ['templates:read'] },
      { path: 'pdf-templates', scopes: ['templates:read'] },
      { path: 'data', scopes: ['uploads:read', 'mappings:read'] },
      { path: 'campaigns', scopes: ['campaigns:read'] },
    ];
    const first = sections.find((section) => this.embed.hasScopes(section.scopes));
    if (first) void this.router.navigate(['/embed/projects', session.projectId, first.path], { replaceUrl: true });
  }

  ngAfterViewInit(): void {
    if (typeof ResizeObserver === 'undefined' || !this.content) return;
    this.resizeObserver = new ResizeObserver(() => this.embed.postResize(this.document.documentElement.scrollHeight));
    this.resizeObserver.observe(this.content.nativeElement);
    this.embed.postResize(this.document.documentElement.scrollHeight);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  protected hasAvailableSection(): boolean {
    return this.embed.hasScope('templates:read') || this.embed.hasScopes(['uploads:read', 'mappings:read']) || this.embed.hasScope('campaigns:read');
  }

  protected statusTitle(): string {
    if (this.embed.state() === 'disabled') return 'Embedding is not enabled';
    if (this.embed.state() === 'expired') return 'Session expired';
    if (this.embed.state() === 'error') return 'Embedding could not start';
    return 'Loading embedded workspace';
  }

  protected statusMessage(): string {
    if (this.embed.state() === 'disabled') return 'The site owner has not enabled embedding for this installation.';
    if (this.embed.state() === 'expired') return 'Session expired. Reload from the host app.';
    if (this.embed.state() === 'error') return 'The embed session could not be verified. Reload from the host app.';
    return 'Connecting securely to the project…';
  }
}
