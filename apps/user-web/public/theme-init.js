(() => {
  const root = document.documentElement;
  const defaultColors = {
    light: { accent: '#D4F03C', secondary: '#A87D55', third: '#151513' },
    dark: { accent: '#D4F03C', secondary: '#D9B38F', third: '#F7EFE7' },
  };
  const presets = {
    slate: '#D4F03C',
    blue: '#2563EB',
    green: '#166534',
    violet: '#6D28D9',
    rose: '#BE123C',
    amber: '#D97706',
  };
  const validColor = (value) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
  const isBaseColors = (value) => value && validColor(value.accent) && validColor(value.secondary) && validColor(value.third);
  const luminance = (value) => {
    const hex = validColor(value) ? value.slice(1) : '151513';
    const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
    const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const contrast = (first, second) => {
    const firstLight = luminance(first);
    const secondLight = luminance(second);
    return (Math.max(firstLight, secondLight) + 0.05) / (Math.min(firstLight, secondLight) + 0.05);
  };
  const foreground = (color) => contrast(color, '#151513') >= contrast(color, '#FFFFFF') ? '#151513' : '#FFFFFF';

  try {
    // Deprecated: read-only fallback for the pre-Slipakar storage key. Remove in a future major release.
    const storedValue = localStorage.getItem('slipakar.theme-preferences') ?? localStorage.getItem('lokaslip.theme-preferences');
    const stored = JSON.parse(storedValue ?? 'null');
    const modes = ['light', 'dark', 'system'];
    const accents = Object.keys(presets);
    const mode = modes.includes(stored?.themeMode) ? stored.themeMode : 'system';
    const accent = accents.includes(stored?.themeAccent) ? stored.themeAccent : 'slate';
    const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    const storedColors = stored?.themeColors;
    const colors = {
      light: isBaseColors(storedColors?.light) ? storedColors.light : { ...defaultColors.light, accent: presets[accent] },
      dark: isBaseColors(storedColors?.dark) ? storedColors.dark : { ...defaultColors.dark, accent: presets[accent] },
    };
    const active = dark ? colors.dark : colors.light;
    root.classList.toggle('dark', dark);
    root.dataset.themeMode = mode;
    root.dataset.accent = accent;
    root.style.setProperty('--accent-custom', active.accent);
    root.style.setProperty('--secondary-custom', active.secondary);
    root.style.setProperty('--third-custom', active.third);
    root.style.setProperty('--primary-foreground', foreground(active.accent));
    root.style.setProperty('--secondary-foreground', foreground(active.secondary));
    root.style.setProperty('--accent-foreground', foreground(active.secondary));
  } catch {
    root.dataset.themeMode = 'system';
    root.dataset.accent = 'slate';
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    const active = dark ? defaultColors.dark : defaultColors.light;
    root.classList.toggle('dark', dark);
    root.style.setProperty('--accent-custom', active.accent);
    root.style.setProperty('--secondary-custom', active.secondary);
    root.style.setProperty('--third-custom', active.third);
    root.style.setProperty('--primary-foreground', foreground(active.accent));
    root.style.setProperty('--secondary-foreground', foreground(active.secondary));
    root.style.setProperty('--accent-foreground', foreground(active.secondary));
  }
})();
