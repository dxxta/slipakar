import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { Pressed } from './pressed';

type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'slipakar.landing-theme';
const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [Pressed],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      appPressed
      class="theme-toggle"
      type="button"
      [attr.aria-label]="theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
      [attr.aria-pressed]="theme() === 'dark' ? 'true' : 'false'"
      (click)="toggleTheme()"
    >
      @if (theme() === 'dark') {
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
        </svg>
      } @else {
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8 8.5 8.5 0 1 0 20.2 15.4Z" />
        </svg>
      }
    </button>
  `,
})
export class ThemeToggle implements OnInit, OnDestroy {
  readonly theme = signal<Theme>('light');

  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private mediaQuery: MediaQueryList | null = null;
  private mediaChangeListener: ((event: MediaQueryListEvent) => void) | null = null;
  private hasExplicitTheme = false;

  ngOnInit(): void {
    if (!this.isBrowser) return;

    const savedTheme = this.readSavedTheme();
    if (savedTheme) {
      this.hasExplicitTheme = true;
      this.applyTheme(savedTheme);
      return;
    }

    this.document.documentElement.removeAttribute('data-theme');
    try {
      const view = this.document.defaultView;
      if (!view) return;
      this.mediaQuery = view.matchMedia(COLOR_SCHEME_QUERY);
      this.theme.set(this.mediaQuery.matches ? 'dark' : 'light');
      this.mediaChangeListener = (event) => {
        if (!this.hasExplicitTheme) this.theme.set(event.matches ? 'dark' : 'light');
      };
      this.mediaQuery.addEventListener('change', this.mediaChangeListener);
    } catch {
      this.theme.set('light');
    }
  }

  ngOnDestroy(): void {
    if (this.mediaQuery && this.mediaChangeListener) {
      this.mediaQuery.removeEventListener('change', this.mediaChangeListener);
    }
  }

  toggleTheme(): void {
    const nextTheme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(nextTheme);
    if (!this.isBrowser) return;

    this.hasExplicitTheme = true;
    if (this.mediaQuery && this.mediaChangeListener) {
      this.mediaQuery.removeEventListener('change', this.mediaChangeListener);
      this.mediaQuery = null;
      this.mediaChangeListener = null;
    }
    this.document.documentElement.dataset['theme'] = nextTheme;
    try {
      this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The in-memory selection still applies when storage is unavailable.
    }
  }

  private readSavedTheme(): Theme | null {
    try {
      const storedTheme = this.document.defaultView?.localStorage.getItem(THEME_STORAGE_KEY);
      return storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : null;
    } catch {
      return null;
    }
  }

  private applyTheme(theme: Theme): void {
    this.theme.set(theme);
    this.document.documentElement.dataset['theme'] = theme;
  }
}
