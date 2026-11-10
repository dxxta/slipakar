import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, Injector, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerMoon, tablerSun } from '@ng-icons/tabler-icons';
import { ThemePreferencesService } from '../../core/theme-preferences.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ tablerSun, tablerMoon })],
  template: `
    @if (hasPreferences) {
      <button role="menuitem" type="button" class="flex h-control-9 w-full items-center gap-2 rounded-ui-sm px-3 text-left text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" [attr.aria-label]="label()" (click)="toggle()">
        @if (effectiveDark()) {
          <ng-icon name="tablerSun" aria-hidden="true" class="size-4" />
          <span>Light theme</span>
        } @else {
          <ng-icon name="tablerMoon" aria-hidden="true" class="size-4" />
          <span>Dark theme</span>
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
