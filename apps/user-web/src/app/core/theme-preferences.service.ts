import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { ApiClient } from './api-client';
import {
  ACCENT_PRESET_COLORS,
  applyThemePreference,
  defaultThemeColors,
  isHexColor,
  type BaseColorKey,
  type ThemeAccent,
  type ThemeColors,
  type ThemeMode,
  type ThemePreference,
  type ThemeScheme,
} from './theme-preferences';

const preferenceStorageKey = 'slipakar.theme-preferences';
// Deprecated: read-only fallback for the pre-Slipakar storage key. Remove in a future major release.
const legacyPreferenceStorageKey = 'lokaslip.theme-preferences';
const defaultPreference: ThemePreference = { themeMode: 'system', themeAccent: 'slate' };

@Injectable({ providedIn: 'root' })
export class ThemePreferencesService {
  private readonly api = inject(ApiClient);
  private readonly document = inject(DOCUMENT);
  readonly preference = signal<ThemePreference>(defaultPreference);
  readonly themeColors = signal<ThemeColors>(defaultThemeColors());
  private mediaQuery: MediaQueryList | null = null;
  private hasStoredColors = false;

  initialize(): void {
    const cachedPreference = this.readCachedPreference();
    this.preference.set(cachedPreference);
    this.apply(cachedPreference);
    this.watchSystemPreference();
    this.api.get<ThemePreference>('/me/preferences').subscribe({
      next: (preference) => {
        if (!this.isThemePreference(preference)) return;
        if (!this.hasStoredColors) this.themeColors.set(defaultThemeColors(preference.themeAccent));
        this.preference.set(preference);
        this.storePreference(preference);
        this.apply(preference);
      },
      error: () => undefined,
    });
  }

  setPreference(preference: ThemePreference): void {
    if (preference.themeAccent !== this.preference().themeAccent && !this.hasStoredColors) {
      this.themeColors.set(defaultThemeColors(preference.themeAccent));
    }
    this.preference.set(preference);
    this.storePreference(preference);
    this.apply(preference);
    this.api.patch<ThemePreference, ThemePreference>('/me/preferences', preference).subscribe({
      next: (savedPreference) => {
        if (!this.isThemePreference(savedPreference)) return;
        this.preference.set(savedPreference);
        this.storePreference(savedPreference);
        this.apply(savedPreference);
      },
      error: () => undefined,
    });
  }

  setMode(themeMode: ThemeMode): void {
    this.setPreference({ ...this.preference(), themeMode });
  }

  setAccent(themeAccent: ThemeAccent): void {
    const scheme = this.activeScheme();
    this.themeColors.update((colors) => ({
      ...colors,
      [scheme]: { ...colors[scheme], accent: ACCENT_PRESET_COLORS[themeAccent] },
    }));
    this.hasStoredColors = true;
    this.setPreference({ ...this.preference(), themeAccent });
  }

  activeScheme(): ThemeScheme {
    return this.document.documentElement?.classList.contains('dark') ? 'dark' : 'light';
  }

  setBaseColor(scheme: ThemeScheme, key: BaseColorKey, value: string): void {
    if (!isHexColor(value)) return;
    this.themeColors.update((colors) => ({
      ...colors,
      [scheme]: { ...colors[scheme], [key]: value.toUpperCase() },
    }));
    this.hasStoredColors = true;
    this.storePreference(this.preference());
    this.apply(this.preference());
  }

  resetBaseColors(scheme: ThemeScheme): void {
    this.themeColors.update((colors) => ({ ...colors, [scheme]: defaultThemeColors('slate')[scheme] }));
    this.hasStoredColors = true;
    this.setPreference({ ...this.preference(), themeAccent: 'slate' });
  }

  private readCachedPreference(): ThemePreference {
    try {
      const storage = this.document.defaultView?.localStorage;
      const cached = storage?.getItem(preferenceStorageKey);
      if (cached !== null && cached !== undefined) return this.parseCachedPreference(cached) ?? defaultPreference;

      const legacy = storage?.getItem(legacyPreferenceStorageKey);
      if (legacy === null || legacy === undefined) return defaultPreference;
      const parsed = this.parseCachedPreference(legacy);
      if (!parsed) return defaultPreference;
      this.storePreference(parsed);
      storage?.removeItem(legacyPreferenceStorageKey);
      return parsed;
    } catch {
      return defaultPreference;
    }
  }

  private parseCachedPreference(cached: string): ThemePreference | null {
    try {
      const parsed: unknown = JSON.parse(cached);
      if (!this.isThemePreference(parsed)) return null;
      const candidate = parsed as ThemePreference & { themeColors?: unknown };
      if (this.isThemeColors(candidate.themeColors)) {
        this.themeColors.set(candidate.themeColors);
        this.hasStoredColors = true;
      } else {
        this.themeColors.set(defaultThemeColors(candidate.themeAccent));
        this.hasStoredColors = false;
      }
      return { themeMode: candidate.themeMode, themeAccent: candidate.themeAccent };
    } catch {
      return null;
    }
  }

  private storePreference(preference: ThemePreference): void {
    try {
      this.document.defaultView?.localStorage.setItem(preferenceStorageKey, JSON.stringify({ ...preference, themeColors: this.themeColors() }));
      this.hasStoredColors = true;
    } catch {
      return;
    }
  }

  private watchSystemPreference(): void {
    if (
      this.mediaQuery !== null ||
      this.document.defaultView === null ||
      typeof this.document.defaultView.matchMedia !== 'function'
    ) return;
    this.mediaQuery = this.document.defaultView.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQuery.addEventListener('change', () => this.apply(this.preference()));
  }

  private apply(preference: ThemePreference): void {
    const prefersDark = this.mediaQuery?.matches ?? false;
    if (this.document.documentElement !== null) {
      applyThemePreference(this.document.documentElement, preference, prefersDark, this.themeColors());
    }
  }

  private isThemeColors(value: unknown): value is ThemeColors {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as { light?: unknown; dark?: unknown };
    const isBaseColors = (colors: unknown): colors is ThemeColors['light'] => {
      if (typeof colors !== 'object' || colors === null) return false;
      const base = colors as { accent?: unknown; secondary?: unknown; third?: unknown };
      return isHexColor(String(base.accent ?? '')) && isHexColor(String(base.secondary ?? '')) && isHexColor(String(base.third ?? ''));
    };
    return isBaseColors(candidate.light) && isBaseColors(candidate.dark);
  }

  private isThemePreference(value: unknown): value is ThemePreference {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as { themeMode?: unknown; themeAccent?: unknown };
    return (
      ['light', 'dark', 'system'].includes(candidate.themeMode as string) &&
      ['slate', 'blue', 'green', 'violet', 'rose', 'amber'].includes(candidate.themeAccent as string)
    );
  }
}
