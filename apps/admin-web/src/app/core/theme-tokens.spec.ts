import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const specPath = resolve(process.cwd(), 'src/app/core/theme-tokens.spec.ts');
const themeCss = readFileSync(resolve(dirname(specPath), '../../../../../packages/ui/src/theme.css'), 'utf8');
const requiredTokens = [
  'background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground',
  'primary', 'primary-foreground', 'secondary', 'secondary-foreground', 'muted', 'muted-foreground',
  'accent', 'accent-foreground', 'destructive', 'destructive-foreground', 'border', 'input', 'ring',
  'sidebar', 'sidebar-foreground', 'sidebar-primary', 'sidebar-primary-foreground', 'sidebar-accent',
  'sidebar-accent-foreground', 'sidebar-border', 'sidebar-ring', 'chart-1', 'chart-2', 'chart-3',
  'chart-4', 'chart-5',
];
const textPairs = [
  ['foreground', 'background'], ['card-foreground', 'card'], ['popover-foreground', 'popover'],
  ['primary-foreground', 'primary'], ['secondary-foreground', 'secondary'],
  ['muted-foreground', 'background'], ['muted-foreground', 'card'], ['accent-foreground', 'accent'],
  ['destructive-foreground', 'destructive'], ['sidebar-foreground', 'sidebar'],
] as const;

describe('shared theme tokens', () => {
  it('defines the complete semantic palette for light and dark mode', () => {
    for (const selector of [':root', ':root.dark']) {
      const tokens = parseBlock(themeCss, selector);
      for (const token of requiredTokens) expect(tokens.has(token), `${selector} --${token}`).toBe(true);
    }
  });

  it('uses accessible hex colors for text and non-text contrast in light and dark mode', () => {
    for (const selector of [':root', ':root.dark']) {
      const tokens = parseBlock(themeCss, selector);
      for (const [foreground, background] of textPairs) {
        expect(contrast(tokens, foreground, background), `${selector} ${foreground}/${background}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(tokens, 'ring', 'background'), `${selector} ring/background`).toBeGreaterThanOrEqual(3);
      expect(contrast(tokens, 'border', 'background'), `${selector} border/background`).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every accent override readable in light and dark mode', () => {
    for (const accent of ['blue', 'green', 'violet', 'rose', 'amber']) {
      for (const dark of [false, true]) {
        const selector = dark ? `:root.dark[data-accent='${accent}']` : `:root[data-accent='${accent}']`;
        const tokens = parseBlock(themeCss, selector);
        expect(contrast(tokens, 'primary-foreground', 'primary'), `${selector} primary`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

function parseBlock(css: string, selector: string): Map<string, string> {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`Missing theme block: ${selector}`);
  return new Map([...match[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, token, value]) => [token, value.trim()]));
}

function contrast(tokens: Map<string, string>, foregroundName: string, backgroundName: string): number {
  const foreground = parseHex(tokens.get(foregroundName) ?? '');
  const background = parseHex(tokens.get(backgroundName) ?? '');
  const luminance = (rgb: number[]): number => {
    const [red, green, blue] = rgb.map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseHex(value: string): number[] {
  expect(value).toMatch(/^#[\da-f]{6}$/i);
  const hex = value.slice(1);
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}
