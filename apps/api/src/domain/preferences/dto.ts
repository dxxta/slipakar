import { z } from 'zod';

export const THEME_MODES = ['light', 'dark', 'system'] as const;
export const THEME_ACCENTS = ['slate', 'blue', 'green', 'violet', 'rose', 'amber'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];
export type ThemeAccent = (typeof THEME_ACCENTS)[number];

export const themePreferencesViewDto = z.strictObject({
  themeMode: z.enum(THEME_MODES),
  themeAccent: z.enum(THEME_ACCENTS),
});

export type ThemePreferencesView = z.infer<typeof themePreferencesViewDto>;

export const updateThemePreferencesDto = z
  .strictObject({
    themeMode: z.enum(THEME_MODES).optional(),
    themeAccent: z.enum(THEME_ACCENTS).optional(),
  })
  .refine(
    (data) => data.themeMode !== undefined || data.themeAccent !== undefined,
    {
      message: 'At least one field (themeMode or themeAccent) must be provided',
    },
  );

export type UpdateThemePreferencesDto = z.infer<typeof updateThemePreferencesDto>;
