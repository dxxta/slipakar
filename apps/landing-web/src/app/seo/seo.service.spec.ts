import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { describe, expect, it, beforeEach } from 'vitest';
import { contentEn } from '../content/content.en';
import { contentId } from '../content/content.id';
import { LANDING_CONFIG } from '../runtime-config';
import { SeoService } from './seo.service';

const publicPages = [
  [contentEn.home.metadata, 'en', contentId.home.metadata],
  [contentId.home.metadata, 'id', contentEn.home.metadata],
  [contentEn.terms.metadata, 'en', contentId.terms.metadata],
  [contentId.terms.metadata, 'id', contentEn.terms.metadata],
] as const;

describe('SeoService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SeoService,
        Title,
        { provide: LANDING_CONFIG, useValue: { appUrl: 'http://localhost:8080', siteUrl: 'https://site.example', repoUrl: 'https://repo.example', docsUrl: 'https://docs.example', statusUrl: '' } },
      ],
    });
  });

  it('sets a unique title, description, and canonical for every indexable route', () => {
    const seo = TestBed.inject(SeoService);
    const title = TestBed.inject(Title);
    const document = TestBed.inject(DOCUMENT);
    const observedTitles: string[] = [];
    const observedDescriptions: string[] = [];
    const observedCanonicals: string[] = [];

    for (const [metadata, language, alternate] of publicPages) {
      seo.setPage(metadata, language, alternate);
      observedTitles.push(title.getTitle());
      observedDescriptions.push(document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? '');
      observedCanonicals.push(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? '');
    }

    expect(new Set(observedTitles).size).toBe(publicPages.length);
    expect(new Set(observedDescriptions).size).toBe(publicPages.length);
    expect(new Set(observedCanonicals).size).toBe(publicPages.length);
    expect(observedCanonicals).toEqual(publicPages.map(([metadata]) => `https://site.example${metadata.path}`));
  });

  it('sets language alternates and home JSON-LD, but removes indexing from a not-found page', () => {
    const seo = TestBed.inject(SeoService);
    const document = TestBed.inject(DOCUMENT);
    seo.setPage(contentEn.home.metadata, 'en', contentId.home.metadata);
    seo.setHomeStructuredData(contentEn.home.metadata, contentEn.home.faq.items);

    expect(document.querySelector('link[rel="alternate"][hreflang="en"]')?.getAttribute('href')).toBe('https://site.example/');
    expect(document.querySelector('link[rel="alternate"][hreflang="id"]')?.getAttribute('href')).toBe('https://site.example/id');
    expect(document.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(3);

    seo.setNotFound();
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,nofollow');
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(0);
  });
});
