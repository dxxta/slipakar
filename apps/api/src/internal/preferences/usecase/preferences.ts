import { AppError } from '../../../lib/app-error.js';
import { validateAndThrow } from '../../../lib/validate-and-throw.js';
import {
  updateThemePreferencesDto,
  type ThemePreferencesView,
} from '../../../domain/preferences/dto.js';
import type {
  PreferencesRepositoryInterface,
  PreferencesUseCaseInterface,
} from '../../../domain/preferences/interface.js';

export class PreferencesUseCase implements PreferencesUseCaseInterface {
  constructor(private readonly repository: PreferencesRepositoryInterface) {}

  async getPreferences(userId: string): Promise<ThemePreferencesView> {
    const prefs = await this.repository.findByUserId(userId);
    if (!prefs) {
      throw new AppError(404, 'NOT_FOUND', 'User preferences not found');
    }
    return prefs;
  }

  async updatePreferences(userId: string, data: unknown): Promise<ThemePreferencesView> {
    const validated = validateAndThrow({
      schema: updateThemePreferencesDto,
      data,
    });

    const existing = await this.repository.findByUserId(userId);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    return this.repository.updateByUserId(userId, validated);
  }
}
