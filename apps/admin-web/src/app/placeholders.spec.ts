import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

describe('Form control placeholders', () => {
  function getAllFiles(dir: string): string[] {
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
    // Current file is apps/admin-web/src/app/placeholders.spec.ts
    // Check apps/admin-web/src/app/features and apps/admin-web/src/app/pages
    const appDir = __dirname;
    const featuresDir = join(appDir, 'features');
    const pagesDir = join(appDir, 'pages');

    const files = [...getAllFiles(featuresDir), ...getAllFiles(pagesDir)];
    expect(files.length).toBeGreaterThan(0);

    const violations: { file: string; element: string }[] = [];

    // Regex to match <input ...> and <textarea ...> tags
    const tagRegex = /<(input|textarea)\b([^>]*)>/gi;

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      let match: RegExpExecArray | null;

      while ((match = tagRegex.exec(content)) !== null) {
        const [fullTag, tagName, attrs] = match;

        if (tagName.toLowerCase() === 'input') {
          // Check type attribute
          const typeMatch = /type=["']([^"']+)["']/i.exec(attrs);
          const type = typeMatch ? typeMatch[1].toLowerCase() : 'text';

          // Skip checkbox, radio, file, hidden, submit, button
          if (['checkbox', 'radio', 'file', 'hidden', 'submit', 'button'].includes(type)) {
            continue;
          }
        }

        // Check for placeholder or [placeholder] or [attr.placeholder]
        const hasPlaceholder =
          /\bplaceholder=["'][^"']+["']/i.test(attrs) ||
          /\[(attr\.)?placeholder\]=["'][^"']+["']/i.test(attrs);

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
