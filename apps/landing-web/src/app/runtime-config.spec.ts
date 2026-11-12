import { describe, expect, it } from 'vitest';
import { DEFAULT_LANDING_CONFIG, LANDING_CONFIG, applyRuntimeConfigToHtml, createLandingRuntimeConfig, landingAllowedHosts, readLandingConfigFromDocument } from './runtime-config';
import { TestBed } from '@angular/core/testing';
import { contentEn } from './content/content.en';
import { LandingHeaderComponent } from './home/home-sections';

describe('landing runtime config', () => {
  it('uses safe localhost defaults when values are missing', () => {
    expect(createLandingRuntimeConfig({})).toEqual(DEFAULT_LANDING_CONFIG);
  });

  it('keeps explicit app and site URLs', () => {
    expect(createLandingRuntimeConfig({ LANDING_APP_URL: 'http://localhost:4300', LANDING_SITE_URL: 'http://localhost:4302' })).toMatchObject({ appUrl: 'http://localhost:4300', siteUrl: 'http://localhost:4302' });
  });

  it('allows the configured public hostname and local verification hosts for SSR', () => {
    const config = createLandingRuntimeConfig({ LANDING_SITE_URL: 'https://landing.example' });
    expect(landingAllowedHosts(config)).toEqual(['landing.example', 'localhost', '127.0.0.1']);
  });

  it('reads runtime values from SSR-rendered metadata without a window global', () => {
    const document = new DOMParser().parseFromString(
      '<meta name="landing-runtime-config" content="{&quot;appUrl&quot;:&quot;https://app.example&quot;,&quot;siteUrl&quot;:&quot;https://site.example&quot;,&quot;repoUrl&quot;:&quot;https://code.example/repo&quot;,&quot;docsUrl&quot;:&quot;https://docs.example&quot;}">',
      'text/html',
    );
    const metaContent = document.querySelector('meta')?.content ?? '';
    expect(metaContent).toContain('https://app.example');
    expect(JSON.parse(metaContent)).toHaveProperty('appUrl', 'https://app.example');
    expect(readLandingConfigFromDocument(document)).toEqual({
      appUrl: 'https://app.example',
      siteUrl: 'https://site.example',
      repoUrl: 'https://code.example/repo',
      docsUrl: 'https://docs.example',
      statusUrl: '',
    });
  });

  it('injects config into HTML and updates prerendered default URLs', () => {
    const config = createLandingRuntimeConfig({
      LANDING_APP_URL: 'https://app.example',
      LANDING_SITE_URL: 'https://site.example/',
      LANDING_REPO_URL: 'https://code.example/repo',
      LANDING_DOCS_URL: 'https://docs.example/guide',
    });
    const html = `<html><head><meta name="landing-runtime-config" content="{}"><link rel="canonical" href="${DEFAULT_LANDING_CONFIG.siteUrl}/"></head><body><a href="${DEFAULT_LANDING_CONFIG.appUrl}">Sign in</a></body></html>`;

    const result = applyRuntimeConfigToHtml(html, config);
    expect(result).toContain('https://site.example/');
    expect(result).toContain('href="https://app.example"');
    expect(result).toContain('https://docs.example/guide');
    expect(result).toContain('https://code.example/repo');
  });

  it('never renders an admin or API link in the header', async () => {
    await TestBed.configureTestingModule({
      imports: [LandingHeaderComponent],
      providers: [{ provide: LANDING_CONFIG, useValue: { ...DEFAULT_LANDING_CONFIG, adminUrl: 'http://localhost:4301' } as typeof DEFAULT_LANDING_CONFIG }],
    }).compileComponents();
    const fixture = TestBed.createComponent(LandingHeaderComponent);
    fixture.componentRef.setInput('copy', contentEn.home);
    fixture.componentRef.setInput('language', 'en');
    fixture.detectChanges();
    await fixture.whenStable();

    const hrefs = [...(fixture.nativeElement as HTMLElement).querySelectorAll('a')].map((link) => link.getAttribute('href') ?? '');
    expect(hrefs.some((href) => /admin|\/api|4301/i.test(href))).toBe(false);
  });
});
