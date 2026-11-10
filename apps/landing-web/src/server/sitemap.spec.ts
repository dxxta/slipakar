import { describe, expect, it } from 'vitest';
import { INDEXABLE_PATHS, buildSitemapXml } from './sitemap';

describe('sitemap.xml', () => {
  it('includes every indexable route and excludes not-found', () => {
    const sitemap = buildSitemapXml('https://landing.example');

    expect(INDEXABLE_PATHS).toEqual(['/', '/id', '/terms', '/id/terms']);
    for (const path of ['/', '/id', '/terms', '/id/terms']) {
      expect(INDEXABLE_PATHS).toContain(path);
      expect(sitemap).toContain(`<loc>https://landing.example${path}</loc>`);
    }
    expect(sitemap).not.toContain('not-found');
  });
});
