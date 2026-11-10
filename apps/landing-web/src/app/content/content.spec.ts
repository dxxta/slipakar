import { describe, expect, it } from 'vitest';
import { contentEn } from './content.en';
import { contentId } from './content.id';

describe('localized content dictionaries', () => {
  it('have the same typed shape', () => {
    expect(shapeOf(contentEn)).toEqual(shapeOf(contentId));
  });

  it('provides unique SEO metadata and canonical paths for all public routes', () => {
    const routes = [contentEn.home.metadata, contentId.home.metadata, contentEn.terms.metadata, contentId.terms.metadata];
    expect(new Set(routes.map((page) => page.title)).size).toBe(routes.length);
    expect(new Set(routes.map((page) => page.description)).size).toBe(routes.length);
    expect(new Set(routes.map((page) => page.path)).size).toBe(routes.length);
    expect(routes.every((page) => page.title.length > 0 && page.description.length > 0 && page.path.startsWith('/'))).toBe(true);
  });

  it('keeps only home, terms and not-found content with matching localized shapes', () => {
    expect(Object.keys(contentEn).sort()).toEqual(['home', 'language', 'languageName', 'notFound', 'terms']);
    expect(Object.keys(contentId).sort()).toEqual(['home', 'language', 'languageName', 'notFound', 'terms']);
    expect(Object.keys(contentEn.home.nav).sort()).toEqual(['features', 'how', 'signIn']);
    expect(Object.keys(contentId.home.nav).sort()).toEqual(['features', 'how', 'signIn']);
    expect(Object.keys(contentEn.home.final).sort()).toEqual(['body', 'repository', 'signIn', 'terms', 'title']);
    expect(Object.keys(contentId.home.final).sort()).toEqual(['body', 'repository', 'signIn', 'terms', 'title']);
  });

  it('gives the terms page the same sections in both languages', () => {
    expect(contentEn.terms.sections.length).toBeGreaterThan(0);
    expect(contentId.terms.sections.length).toBe(contentEn.terms.sections.length);
    for (const section of [...contentEn.terms.sections, ...contentId.terms.sections]) {
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.body.length).toBeGreaterThan(0);
    }
  });
});

function shapeOf(value: unknown): unknown {
  if (Array.isArray(value)) return value.length === 0 ? [] : [shapeOf(value[0])];
  if (typeof value !== 'object' || value === null) return typeof value;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, shapeOf(entry)]));
}
