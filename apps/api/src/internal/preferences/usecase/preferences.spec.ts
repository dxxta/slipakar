import { describe, expect, it, vi } from 'vitest';
import { PreferencesUseCase } from './preferences.js';
import type { PreferencesRepositoryInterface } from '../../../domain/preferences/interface.js';

describe('PreferencesUseCase', () => {
  it('returns preferences for valid user', async () => {
    const mockRepo: PreferencesRepositoryInterface = {
      findByUserId: vi.fn().mockResolvedValue({
        themeMode: 'system',
        themeAccent: 'slate',
      }),
      updateByUserId: vi.fn(),
    };

    const useCase = new PreferencesUseCase(mockRepo);
    const result = await useCase.getPreferences('user-1');

    expect(result).toEqual({
      themeMode: 'system',
      themeAccent: 'slate',
    });
  });

  it('updates preferences with valid data', async () => {
    const mockRepo: PreferencesRepositoryInterface = {
      findByUserId: vi.fn().mockResolvedValue({
        themeMode: 'system',
        themeAccent: 'slate',
      }),
      updateByUserId: vi.fn().mockResolvedValue({
        themeMode: 'dark',
        themeAccent: 'violet',
      }),
    };

    const useCase = new PreferencesUseCase(mockRepo);
    const result = await useCase.updatePreferences('user-1', {
      themeMode: 'dark',
      themeAccent: 'violet',
    });

    expect(result).toEqual({
      themeMode: 'dark',
      themeAccent: 'violet',
    });
    expect(mockRepo.updateByUserId).toHaveBeenCalledWith('user-1', {
      themeMode: 'dark',
      themeAccent: 'violet',
    });
  });

  it('throws 400 when updating with empty body', async () => {
    const mockRepo: PreferencesRepositoryInterface = {
      findByUserId: vi.fn().mockResolvedValue({
        themeMode: 'system',
        themeAccent: 'slate',
      }),
      updateByUserId: vi.fn(),
    };

    const useCase = new PreferencesUseCase(mockRepo);
    await expect(useCase.updatePreferences('user-1', {})).rejects.toThrow();
  });
});
