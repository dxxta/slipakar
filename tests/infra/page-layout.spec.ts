import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const applicationRoots = ['apps/user-web/src/app', 'apps/admin-web/src/app'];
const duplicatePadding = /\b(?:px-page|py-page|md:px-page-lg|space-y-section)\b/;

function collectPageTemplates(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) return collectPageTemplates(filePath);
    if (!/\.html$|\.ts$/.test(entry.name) || entry.name.endsWith('.spec.ts') || filePath.endsWith('/ui/shared/page-layout.ts')) return [];
    return [filePath];
  });
}

describe('shared page layout', () => {
  it('keeps page padding, vertical spacing and width in PageLayout rather than page wrappers', () => {
    const violations = applicationRoots.flatMap((root) => collectPageTemplates(root)).filter((filePath) => {
      return duplicatePadding.test(fs.readFileSync(filePath, 'utf8'));
    });

    expect(violations).toEqual([]);
  });
});
