import { describe, expect, it } from 'vitest';
import { DEFAULT_LANDING_CONFIG, LANDING_CONFIG, applyRuntimeConfigToHtml, createLandingRuntimeConfig, landingAllowedHosts, readLandingConfigFromDocument } from './runtime-config';
import { TestBed } from '@angular/core/testing';
import { contentEn } from './content/content.en';
import { LandingHeaderComponent } from './home/home-sections';

describe('landing runtime config', () => {
  it('uses safe localhost defaults when values are missing', () => {
    expect(createLandingRuntimeConfig({})).toEqual(DEFAULT_LANDING_CONFIG);
    expect(createLandingRuntimeConfig({})).not.toHaveProperty('adminUrl');
  });

  it('accepts an optional local admin URL while preserving explicit app and site URLs', () => {
    const config = createLandingRuntimeConfig({
      LANDING_APP_URL: 'http://localhost:4300',
      LANDING_SITE_URL: 'http://localhost:4302',
      LANDING_ADMIN_URL: 'http://localhost:4301',
    });

    expect(config).toMatchObject({
      appUrl: 'http://localhost:4300',
      siteUrl: 'http://localhost:4302',
      adminUrl: 'http://localhost:4301',
    });
  });

  it('ignores unsafe or malformed optional admin URLs', () => {
    expect(createLandingRuntimeConfig({ LANDING_ADMIN_URL: 'javascript:alert(1)' })).not.toHaveProperty('adminUrl');
    expect(createLandingRuntimeConfig({ LANDING_ADMIN_URL: 'not a url' })).not.toHaveProperty('adminUrl');
  });

  it('allows the configured public hostname and local verification hosts for SSR', () => {
    const config = createLandingRuntimeConfig({ LANDING_SITE_URL: 'https://landing.example' });
    expect(landingAllowedHosts(config)).toEqual(['landing.example', 'localhost', '127.0.0.1']);
  });

  it('reads runtime values from SSR-rendered metadata without a window global', () => {
    const document = new DOMParser().parseFromString(
      '<meta name="landing-runtime-config" content="{&quot;appUrl&quot;:&quot;https://app.example&quot;,&quot;siteUrl&quot;:&quot;https://site.example&quot;,&quot;repoUrl&quot;:&quot;https://code.example/repo&quot;,&quot;docsUrl&quot;:&quot;https://docs.example&quot;,&quot;adminUrl&quot;:&quot;https://admin.example&quot;}">',
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
      adminUrl: 'https://admin.example',
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

  it('serializes the admin URL only when configured', () => {
    const html = '<html><head></head><body></body></html>';
    const productionHtml = applyRuntimeConfigToHtml(html, DEFAULT_LANDING_CONFIG);
    const developmentConfig = createLandingRuntimeConfig({ LANDING_ADMIN_URL: 'http://localhost:4301' });
    const developmentHtml = applyRuntimeConfigToHtml(html, developmentConfig);

    expect(productionHtml).not.toContain('adminUrl');
    expect(developmentHtml).toContain('&quot;adminUrl&quot;:&quot;http://localhost:4301&quot;');
  });

  it('adds the development-only Admin link to rendered header HTML', () => {
    const html = '<header><div class="header-actions"><landing-language-toggle></landing-language-toggle><a class="button">Sign in</a></div></header>';
    const productionHtml = applyRuntimeConfigToHtml(html, DEFAULT_LANDING_CONFIG);
    const developmentConfig = createLandingRuntimeConfig({ LANDING_ADMIN_URL: 'http://localhost:4301' });
    const developmentHtml = applyRuntimeConfigToHtml(html, developmentConfig);

    expect(productionHtml).not.toContain('>Admin</a>');
    expect(developmentHtml).toContain('<a class="dev-admin-link" href="http://localhost:4301" lang="en" rel="noopener noreferrer">Admin</a>');
  });

  it('renders the Admin link when an admin URL is configured', async () => {
    await TestBed.configureTestingModule({
      imports: [LandingHeaderComponent],
      providers: [{ provide: LANDING_CONFIG, useValue: { ...DEFAULT_LANDING_CONFIG, adminUrl: 'http://localhost:4301' } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(LandingHeaderComponent);
    fixture.componentRef.setInput('copy', contentEn.home);
    fixture.componentRef.setInput('language', 'en');
    fixture.detectChanges();
    await fixture.whenStable();
    const adminLink = [...(fixture.nativeElement as HTMLElement).querySelectorAll('a')].find((link) => link.textContent?.trim() === 'Admin');
    expect(adminLink?.getAttribute('href')).toBe('http://localhost:4301');
    expect(adminLink?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(adminLink?.getAttribute('lang')).toBe('en');
  });

  it('does not render an Admin link without an admin URL', async () => {
    await TestBed.configureTestingModule({
      imports: [LandingHeaderComponent],
      providers: [{ provide: LANDING_CONFIG, useValue: DEFAULT_LANDING_CONFIG }],
    }).compileComponents();
    const fixture = TestBed.createComponent(LandingHeaderComponent);
    fixture.componentRef.setInput('copy', contentEn.home);
    fixture.componentRef.setInput('language', 'en');
    fixture.detectChanges();
    await fixture.whenStable();

    expect([...(fixture.nativeElement as HTMLElement).querySelectorAll('a')].some((link) => link.textContent?.trim() === 'Admin')).toBe(false);
  });
});
