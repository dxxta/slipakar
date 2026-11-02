import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

describe('Form control placeholders', () => {
  function getAllFiles(dir: string): string[] {
    if (!existsSync(dir)) return [];
    const results: string[] = [];
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...getAllFiles(fullPath));
      } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  it('every text-like input and textarea in features and pages has a placeholder attribute or binding', () => {
    // Current file is apps/user-web/src/app/placeholders.spec.ts
    // Check apps/user-web/src/app/features and apps/user-web/src/app/pages (if exists)
    const appDir = __dirname;
    const featuresDir = join(appDir, 'features');
    const pagesDir = join(appDir, 'pages');

    const files = [...getAllFiles(featuresDir), ...getAllFiles(pagesDir)];
    expect(files.length).toBeGreaterThan(0);

    const violations: { file: string; element: string }[] = [];

    // Match opening tags of input and textarea: <input ...> or <textarea ...>
    // Handles attributes across newlines and self-closing / non-self-closing tags
    const tagRegex = /<(input|textarea)\b([^>]*(?:>|$))/gis;

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');

      // Find all tag openings
      const matches = content.matchAll(/<(input|textarea)\b([\s\S]*?)>/gi);

      for (const match of matches) {
        const fullTag = match[0];
        const tagName = match[1].toLowerCase();
        const attrs = match[2];

        if (tagName === 'input') {
          // Check type attribute
          const typeMatch = /type=["']([^"']+)["']/i.exec(attrs);
          const type = typeMatch ? typeMatch[1].toLowerCase() : 'text';

          // Skip checkbox, radio, file, hidden, submit, button, color, range
          if (['checkbox', 'radio', 'file', 'hidden', 'submit', 'button', 'color', 'range'].includes(type)) {
            continue;
          }
        }

        // Check for placeholder or [placeholder] or [attr.placeholder]
        const hasPlaceholder =
          /\bplaceholder\s*=\s*["']/i.test(attrs) ||
          /\[(attr\.)?placeholder\]\s*=\s*["']/i.test(attrs);

        if (!hasPlaceholder) {
          violations.push({
            file: file.replace(appDir, ''),
            element: fullTag,
          });
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
