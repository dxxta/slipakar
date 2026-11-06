import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, Injector, computed, inject, signal } from '@angular/core';
import { ThemePreferencesService } from '../../core/theme-preferences.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  template: `
    @if (hasPreferences) {
      <button type="button" class="grid size-11 shrink-0 place-items-center rounded-ui-md border border-border text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" [attr.aria-label]="label()" [attr.title]="label()" (click)="toggle()">
        @if (effectiveDark()) {
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-4"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>
        } @else {
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="M20.5 15.3A8.5 8.5 0 0 1 8.7 3.5 8.5 8.5 0 1 0 20.5 15.3Z"/></svg>
        }
      </button>
    }
  `,
})
export class ThemeToggle {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  readonly preferences = this.tryGetPreferences();
  protected readonly hasPreferences =
    typeof this.preferences?.preference === 'function' &&
    typeof this.preferences?.setMode === 'function';
  private readonly systemDark = signal(this.readSystemDark());
  protected readonly effectiveDark = computed(() => {
    const preferences = this.preferences;
    const mode = preferences && typeof preferences.preference === 'function'
      ? preferences.preference().themeMode
      : 'system';
    return mode === 'dark' || (mode === 'system' && this.systemDark());
  });
  protected readonly label = computed(() => `Switch to ${this.effectiveDark() ? 'light' : 'dark'} theme`);

  constructor() {
    const mediaQuery = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mediaQuery) return;
    const update = (event: MediaQueryListEvent): void => this.systemDark.set(event.matches);
    mediaQuery.addEventListener('change', update);
    this.destroyRef.onDestroy(() => mediaQuery.removeEventListener('change', update));
  }

  protected toggle(): void {
    const preferences = this.preferences;
    if (preferences && typeof preferences.setMode === 'function') {
      preferences.setMode(this.effectiveDark() ? 'light' : 'dark');
    }
  }

  private tryGetPreferences(): ThemePreferencesService | null {
    try { return this.injector.get(ThemePreferencesService); }
    catch { return null; }
  }

  private readSystemDark(): boolean {
    try { return this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false; }
    catch { return false; }
  }
}
