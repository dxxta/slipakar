export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeAccent = 'slate' | 'blue' | 'green' | 'violet' | 'rose' | 'amber';
export type ThemePreference = { themeMode: ThemeMode; themeAccent: ThemeAccent };
export type ThemeScheme = 'light' | 'dark';
export type AppearanceStyle = 'styled' | 'unstyled';
export type BaseColorKey = 'accent' | 'secondary' | 'third';
export type BaseColors = Record<BaseColorKey, string>;
export type ThemeColors = Record<ThemeScheme, BaseColors>;

export const ACCENT_PRESET_COLORS: Record<ThemeAccent, string> = {
  slate: '#D4F03C',
  blue: '#2563EB',
  green: '#166534',
  violet: '#6D28D9',
  rose: '#BE123C',
  amber: '#D97706',
};

export function defaultThemeColors(accent: ThemeAccent = 'slate'): ThemeColors {
  return {
    light: { accent: ACCENT_PRESET_COLORS[accent], secondary: '#A87D55', third: '#000000' },
    dark: { accent: ACCENT_PRESET_COLORS[accent], secondary: '#D9B38F', third: '#000000' },
  };
}

export function isHexColor(value: string): boolean {
  return /^#[\da-f]{6}$/i.test(value);
}

export function contrastRatio(first: string, second: string): number {
  const luminance = (hex: string): number => {
    const normalized = isHexColor(hex) ? hex.slice(1) : '000000';
    const channels = [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255);
    const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
  };
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  const brightest = Math.max(firstLuminance, secondLuminance);
  const darkest = Math.min(firstLuminance, secondLuminance);
  return (brightest + 0.05) / (darkest + 0.05);
}

export function readableForeground(color: string, ink = '#000000'): string {
  return contrastRatio(color, ink) >= contrastRatio(color, '#FFFFFF') ? ink : '#FFFFFF';
}

export function applyThemePreference(
  root: HTMLElement,
  preference: ThemePreference,
  systemPrefersDark: boolean,
  themeColors: ThemeColors = defaultThemeColors(preference.themeAccent),
  appearanceStyle: AppearanceStyle = 'styled',
): void {
  const useDark = preference.themeMode === 'dark' || (preference.themeMode === 'system' && systemPrefersDark);
  const colors = useDark ? themeColors.dark : themeColors.light;
  root.classList.toggle('dark', useDark);
  root.dataset['themeMode'] = preference.themeMode;
  root.dataset['accent'] = preference.themeAccent;
  root.dataset['style'] = appearanceStyle;
  root.style.setProperty('--accent-custom', colors.accent);
  root.style.setProperty('--secondary-custom', colors.secondary);
  root.style.setProperty('--third-custom', colors.third);
  root.style.setProperty('--primary-foreground', readableForeground(colors.accent, colors.third));
  root.style.setProperty('--secondary-foreground', readableForeground(colors.secondary, colors.third));
  root.style.setProperty('--accent-foreground', readableForeground(colors.secondary, colors.third));
  root.style.setProperty('--ring', colors.accent);
  root.style.setProperty('--sidebar-ring', colors.accent);
}
