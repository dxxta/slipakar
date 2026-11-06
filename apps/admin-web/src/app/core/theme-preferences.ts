export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeAccent = 'slate' | 'blue' | 'green' | 'violet' | 'rose' | 'amber';
export type ThemePreference = { themeMode: ThemeMode; themeAccent: ThemeAccent };

export function applyThemePreference(
  root: HTMLElement,
  preference: ThemePreference,
  systemPrefersDark: boolean,
): void {
  const useDark = preference.themeMode === 'dark' || (preference.themeMode === 'system' && systemPrefersDark);
  root.classList.toggle('dark', useDark);
  root.dataset['themeMode'] = preference.themeMode;
  root.dataset['accent'] = preference.themeAccent;
}
