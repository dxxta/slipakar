import { Component, inject, signal } from '@angular/core';
import { ThemePreferencesService } from '../../core/theme-preferences.service';
import {
  contrastRatio,
  isHexColor,
  readableForeground,
  type AppearanceStyle,
  type BaseColorKey,
  type ThemeAccent,
  type ThemeMode,
} from '../../core/theme-preferences';
import { HlmButton } from '../../ui/button/src/lib/hlm-button';
import { PageHeader, SelectControl, SegmentedTabs, type TabItem } from '../../ui';
import { Ripple } from '../../ui/shared/ripple';
import { Pressed } from '../../ui/shared/pressed';

@Component({
  selector: 'app-preferences-page',
  imports: [Ripple, Pressed, HlmButton, PageHeader, SelectControl, SegmentedTabs],
  template: `
    <app-page-header
      title="Preferences"
      description="Personalize the appearance of your admin workspace."
      badge="Admin"
      [topLevel]="true"
    />
    <section appPressed class="space-y-5 rounded-ui-lg border border-border bg-card p-card shadow-sm" aria-labelledby="appearance-heading">
      <div><h2 id="appearance-heading" class="text-lg font-semibold">Appearance</h2><p class="mt-1 text-sm text-muted-foreground">Your selection is saved to your account and applied immediately.</p></div>
      <div class="grid gap-5 sm:grid-cols-2">
        <div class="grid content-start gap-2"><label for="theme-mode" class="text-sm font-medium">Color theme</label><select id="theme-mode" appSelect class="h-control-9 w-full rounded-ui-md border border-input bg-background px-3 text-sm" [value]="themePreferences.preference().themeMode" (change)="changeThemeMode($event)"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
        <div class="grid content-start gap-2"><span id="appearance-style-label" class="text-sm font-medium">Appearance style</span><app-segmented-tabs ariaLabel="Appearance style" [items]="appearanceStyleOptions" [selected]="themePreferences.appearanceStyle()" (selectedChange)="changeAppearanceStyle($event)" /></div>
        <fieldset class="grid gap-2"><legend class="text-sm font-medium">Accent color</legend><div class="accent-swatch-row flex flex-wrap gap-2">@for (accent of accents; track accent) { <button type="button" class="theme-accent-swatch grid size-11 place-items-center rounded-full border border-border aria-pressed:ring-2 aria-pressed:ring-ring aria-pressed:ring-offset-2 aria-pressed:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" [attr.aria-label]="accentLabel(accent)" [attr.aria-pressed]="themePreferences.preference().themeAccent === accent" (click)="themePreferences.setAccent(accent)"><span class="size-6 rounded-full" [style.backgroundColor]="accentColor(accent)" aria-hidden="true"></span></button> }</div></fieldset>
        <fieldset class="m-0 min-w-0 border-0 p-0 sm:col-span-2">
          <legend class="mb-2 p-0 text-sm font-medium">Base colours · {{ activeSchemeLabel() }} theme</legend>
          <div class="grid gap-4 sm:grid-cols-3">
            @for (field of baseColorFields; track field.key) {
              <label class="grid min-w-0 content-start gap-2 rounded-ui-md border border-border bg-muted/40 p-3">
                <span class="text-sm font-medium">{{ field.label }}</span>
                <span class="flex min-w-0 items-center gap-2">
                  <input type="color" class="base-color-picker" [value]="baseColorValue(field.key)" [attr.aria-label]="field.label + ' color picker'" (input)="changeBaseColor(field.key, $event)" />
                  <input type="text" class="base-color-hex min-w-0 flex-1" [value]="baseColorDraft(field.key)" [attr.aria-label]="field.label + ' hex value'" [attr.aria-invalid]="baseColorDraftInvalid(field.key) ? 'true' : null" placeholder="#D4F03C" pattern="^#[0-9A-Fa-f]{6}$" maxlength="7" spellcheck="false" (input)="changeBaseColorHex(field.key, $event)" />
                </span>
                @if (baseColorDraftInvalid(field.key)) { <span class="text-xs text-[#E5484D]">Enter a color in #RRGGBB format.</span> }
              </label>
            }
          </div>
          @if (accentContrastWarning()) { <p role="status" class="mt-3 text-xs text-muted-foreground">This accent has less than 4.5:1 contrast with ink or white text. It is still allowed.</p> }
          <button hlmBtn variant="outline" type="button" class="mt-3" (click)="resetBaseColors()">Reset to default</button>
        </fieldset>
      </div>
      <div data-theme-preview aria-live="polite" class="flex flex-wrap items-center justify-between gap-4 rounded-ui-md border border-border bg-muted p-4"><div><p class="text-sm font-medium">Live preview</p><p class="mt-1 text-xs text-muted-foreground">Theme colors are previewed as you choose them.</p></div><button hlmBtn type="button">Preview action</button></div>
    </section>
  `,
})
export class PreferencesPage {
  protected readonly themePreferences = inject(ThemePreferencesService);
  protected readonly accents: ThemeAccent[] = ['slate', 'blue', 'green', 'violet', 'rose', 'amber'];
  protected readonly appearanceStyleOptions: TabItem[] = [
    { id: 'styled', label: 'Styled' },
    { id: 'unstyled', label: 'Unstyled' },
  ];
  protected readonly baseColorFields: { key: BaseColorKey; label: string }[] = [
    { key: 'accent', label: 'Accent' },
    { key: 'secondary', label: 'Secondary' },
    { key: 'third', label: 'Third' },
  ];
  private readonly baseColorDrafts = signal<Record<string, string>>({});

  protected changeThemeMode(event: Event): void {
    this.themePreferences.setMode((event.currentTarget as HTMLSelectElement).value as ThemeMode);
    this.baseColorDrafts.set({});
  }

  protected accentLabel(accent: ThemeAccent): string {
    return accent === 'slate' ? 'Slipakar accent' : `${accent[0]?.toUpperCase()}${accent.slice(1)} accent`;
  }

  protected accentColor(accent: ThemeAccent): string {
    const colors: Record<ThemeAccent, string> = {
      slate: '#D4F03C', blue: '#2563EB', green: '#166534',
      violet: '#6D28D9', rose: '#BE123C', amber: '#D97706',
    };
    return colors[accent];
  }

  protected changeAppearanceStyle(style: string): void {
    if (style === 'styled' || style === 'unstyled') this.themePreferences.setAppearanceStyle(style as AppearanceStyle);
  }

  protected activeSchemeLabel(): string {
    return this.themePreferences.activeScheme() === 'dark' ? 'Dark' : 'Light';
  }

  protected baseColorValue(key: BaseColorKey): string {
    return this.themePreferences.themeColors()[this.themePreferences.activeScheme()][key];
  }

  protected baseColorDraft(key: BaseColorKey): string {
    return this.baseColorDrafts()[this.baseColorDraftKey(key)] ?? this.baseColorValue(key);
  }

  protected baseColorDraftInvalid(key: BaseColorKey): boolean {
    return !isHexColor(this.baseColorDraft(key));
  }

  protected changeBaseColor(key: BaseColorKey, event: Event): void {
    const value = (event.currentTarget as HTMLInputElement).value.toUpperCase();
    this.baseColorDrafts.update((drafts) => ({ ...drafts, [this.baseColorDraftKey(key)]: value }));
    this.themePreferences.setBaseColor(this.themePreferences.activeScheme(), key, value);
  }

  protected changeBaseColorHex(key: BaseColorKey, event: Event): void {
    const value = (event.currentTarget as HTMLInputElement).value;
    this.baseColorDrafts.update((drafts) => ({ ...drafts, [this.baseColorDraftKey(key)]: value }));
    if (isHexColor(value)) this.themePreferences.setBaseColor(this.themePreferences.activeScheme(), key, value);
  }

  protected accentContrastWarning(): boolean {
    const accent = this.baseColorValue('accent');
    const ink = this.themePreferences.themeColors()[this.themePreferences.activeScheme()].third;
    return contrastRatio(accent, readableForeground(accent, ink)) < 4.5;
  }

  protected resetBaseColors(): void {
    this.themePreferences.resetBaseColors(this.themePreferences.activeScheme());
    this.baseColorDrafts.set({});
  }

  private baseColorDraftKey(key: BaseColorKey): string {
    return `${this.themePreferences.activeScheme()}:${key}`;
  }
}
