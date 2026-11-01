import { describe, expect, it } from 'vitest';
import { updateThemePreferencesDto } from './dto.js';

describe('Theme preferences DTO', () => {
  it('validates themeMode and themeAccent', () => {
    const valid = updateThemePreferencesDto.parse({
      themeMode: 'dark',
      themeAccent: 'violet',
    });
    expect(valid).toEqual({
      themeMode: 'dark',
      themeAccent: 'violet',
    });
  });

  it('allows updating only themeMode', () => {
    const valid = updateThemePreferencesDto.parse({
      themeMode: 'light',
    });
    expect(valid).toEqual({
      themeMode: 'light',
    });
  });

  it('rejects invalid accent', () => {
    expect(() =>
      updateThemePreferencesDto.parse({
        themeAccent: 'emerald' as unknown as 'slate',
      }),
    ).toThrow();
  });

  it('rejects empty object (at least one field required)', () => {
    expect(() => updateThemePreferencesDto.parse({})).toThrow();
  });

  it('rejects unknown fields (strict)', () => {
    expect(() =>
      updateThemePreferencesDto.parse({
        themeMode: 'dark',
        unknownField: true,
      }),
    ).toThrow();
  });
});
