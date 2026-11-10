import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { ApiClient } from './api-client';
import {
  applyThemePreference,
  type ThemeAccent,
  type ThemeMode,
  type ThemePreference,
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
  private mediaQuery: MediaQueryList | null = null;

  initialize(): void {
    const cachedPreference = this.readCachedPreference();
    this.preference.set(cachedPreference);
    this.apply(cachedPreference);
    this.watchSystemPreference();
    this.api.get<ThemePreference>('/me/preferences').subscribe({
      next: (preference) => {
        if (!this.isThemePreference(preference)) return;
        this.preference.set(preference);
        this.storePreference(preference);
        this.apply(preference);
      },
      error: () => undefined,
    });
  }

  setPreference(preference: ThemePreference): void {
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
    this.setPreference({ ...this.preference(), themeAccent });
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
      return this.isThemePreference(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private storePreference(preference: ThemePreference): void {
    try {
      this.document.defaultView?.localStorage.setItem(preferenceStorageKey, JSON.stringify(preference));
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
      applyThemePreference(this.document.documentElement, preference, prefersDark);
    }
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
