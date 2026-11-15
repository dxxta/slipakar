import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ThemeToggle } from './ui/theme-toggle';
import { LANDING_CONFIG } from './runtime-config';
import { contentEn } from './content/content.en';
import { contentId } from './content/content.id';
import { LandingDictionary } from './content/content.types';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ThemeToggle],
  selector: 'app-root',
  styleUrl: './app.css',
  host: { '(document:click)': 'handleClick($event)' },
  template: `
    <router-outlet />
    <app-theme-toggle />
    @if (notice()) {
      <div class="signin-notice-backdrop" (click)="closeNotice()" (keydown.escape)="closeNotice()">
        <section class="signin-notice" role="alertdialog" aria-modal="true" aria-labelledby="signin-notice-message">
          <p id="signin-notice-message">{{ notice() }}</p>
          <button type="button" (click)="closeNotice()">OK</button>
        </section>
      </div>
    }
  `,
})
export class App implements OnInit {
  private readonly document = inject(DOCUMENT);
  private readonly config = inject(LANDING_CONFIG);
  readonly notice = signal<string | null>(null);
  private signInDisabled = false;
  ngOnInit(): void {
    const window = this.document.defaultView;
    if (!window) return;
    void window.fetch(`${this.config.apiUrl}/public/config/signin`, { cache: 'no-store' }).then(async (response) => {
      if (response.ok) {
        const config: unknown = await response.json();
        this.signInDisabled = typeof config === 'object' && config !== null && (config as { enabled?: unknown }).enabled === true;
      }
    }).catch(() => undefined);
  }

  handleClick(event: Event): void {
    if (!this.signInDisabled || !(event.target instanceof Element)) return;
    const anchor = event.target.closest('a');
    if (!anchor) return;
    const appUrl = anchor.getAttribute('href');
    if (appUrl && new URL(appUrl, this.document.defaultView?.location.origin).href.replace(/\/$/, '') === this.config.appUrl.replace(/\/$/, '')) {
      event.preventDefault();
      const language = this.document.defaultView?.location.pathname.startsWith('/id') ? 'id' : 'en';
      const dictionary: LandingDictionary = language === 'id' ? contentId : contentEn;
      this.notice.set(dictionary.signInDisabled);
    }
  }

  closeNotice(): void { this.notice.set(null); }
}
