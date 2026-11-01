import type { ThemePreferencesView, UpdateThemePreferencesDto } from './dto.js';

export interface PreferencesRepositoryInterface {
  findByUserId(userId: string): Promise<ThemePreferencesView | null>;
  updateByUserId(userId: string, data: UpdateThemePreferencesDto): Promise<ThemePreferencesView>;
}

export interface PreferencesUseCaseInterface {
  getPreferences(userId: string): Promise<ThemePreferencesView>;
  updatePreferences(userId: string, data: unknown): Promise<ThemePreferencesView>;
}
