import { Component, inject } from '@angular/core';
import { ThemePreferencesService } from '../../core/theme-preferences.service';
import { type ThemeAccent, type ThemeMode } from '../../core/theme-preferences';
import { HlmButton } from '../../ui/button/src/lib/hlm-button';
import { PageHeader, SelectControl } from '../../ui';

@Component({
  selector: 'app-preferences-page',
  imports: [HlmButton, PageHeader, SelectControl],
  template: `
    <app-page-header
      title="Preferences"
      description="Personalize the appearance of your admin workspace."
      badge="Admin"
      [topLevel]="true"
    />
    <section class="space-y-5 rounded-ui-lg border border-border bg-card p-card" aria-labelledby="appearance-heading">
      <div><h2 id="appearance-heading" class="text-lg font-semibold">Appearance</h2><p class="mt-1 text-sm text-muted-foreground">Your selection is saved to your account and applied immediately.</p></div>
      <div class="grid gap-5 sm:grid-cols-2">
        <div class="grid content-start gap-2"><label for="theme-mode" class="text-sm font-medium">Color theme</label><select id="theme-mode" appSelect class="min-h-11 w-full rounded-ui-md border border-input bg-background px-3 text-sm" [value]="themePreferences.preference().themeMode" (change)="changeThemeMode($event)"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
        <fieldset class="grid gap-2"><legend class="text-sm font-medium">Accent color</legend><div class="flex flex-wrap gap-2">@for (accent of accents; track accent) { <button type="button" class="grid size-11 place-items-center rounded-full border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" [attr.aria-label]="accentLabel(accent)" [attr.aria-pressed]="themePreferences.preference().themeAccent === accent" (click)="themePreferences.setAccent(accent)"><span class="size-6 rounded-full" [class]="accentClass(accent)" aria-hidden="true"></span></button> }</div></fieldset>
      </div>
      <div data-theme-preview aria-live="polite" class="flex flex-wrap items-center justify-between gap-4 rounded-ui-md border border-border bg-muted p-4"><div><p class="text-sm font-medium">Live preview</p><p class="mt-1 text-xs text-muted-foreground">Theme colors are previewed as you choose them.</p></div><button hlmBtn type="button">Preview action</button></div>
    </section>
  `,
})
export class PreferencesPage {
  protected readonly themePreferences = inject(ThemePreferencesService);
  protected readonly accents: ThemeAccent[] = ['slate', 'blue', 'green', 'violet', 'rose', 'amber'];

  protected changeThemeMode(event: Event): void {
    this.themePreferences.setMode((event.currentTarget as HTMLSelectElement).value as ThemeMode);
  }

  protected accentLabel(accent: ThemeAccent): string { return `${accent[0]?.toUpperCase()}${accent.slice(1)} accent`; }

  protected accentClass(accent: ThemeAccent): string {
    const classes: Record<ThemeAccent, string> = {
      slate: 'bg-slate-700', blue: 'bg-blue-600', green: 'bg-green-700',
      violet: 'bg-violet-700', rose: 'bg-rose-700', amber: 'bg-amber-500',
    };
    return classes[accent];
  }
}
