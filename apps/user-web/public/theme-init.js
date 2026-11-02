(() => {
  try {
    const stored = JSON.parse(localStorage.getItem('lokaslip.theme-preferences') ?? 'null');
    const modes = ['light', 'dark', 'system'];
    const accents = ['slate', 'blue', 'green', 'violet', 'rose', 'amber'];
    const mode = modes.includes(stored?.themeMode) ? stored.themeMode : 'system';
    const accent = accents.includes(stored?.themeAccent) ? stored.themeAccent : 'slate';
    const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.dataset.themeMode = mode;
    document.documentElement.dataset.accent = accent;
  } catch {
    document.documentElement.dataset.themeMode = 'system';
    document.documentElement.dataset.accent = 'slate';
  }
})();
