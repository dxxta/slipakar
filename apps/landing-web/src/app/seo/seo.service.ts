import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { LandingRuntimeConfig, LANDING_CONFIG } from '../runtime-config';
import { PageMetadata } from '../content/content.types';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly document = inject(DOCUMENT);
  private readonly config = inject(LANDING_CONFIG);

  setPage(metadata: PageMetadata, language: 'en' | 'id', homeMetadata?: PageMetadata): void {
    this.title.setTitle(metadata.title);
    this.document.documentElement.lang = language;
    this.setMeta('description', metadata.description);
    this.setMeta('robots', 'index,follow,noai,noimageai');
    this.setMeta('og:title', metadata.title, 'property');
    this.setMeta('og:description', metadata.description, 'property');
    this.setMeta('og:url', this.absoluteUrl(metadata.path), 'property');
    this.setMeta('og:type', 'website', 'property');
    this.setMeta('twitter:card', 'summary');
    this.setMeta('twitter:title', metadata.title);
    this.setMeta('twitter:description', metadata.description);
    this.setCanonical(this.absoluteUrl(metadata.path));
    this.setAlternates(metadata, language, homeMetadata);
  }

  setNotFound(): void {
    this.title.setTitle('Page not found — LokaSlip');
    this.setMeta('robots', 'noindex,nofollow');
    this.removeCanonical();
    this.removeAlternates();
    this.removeJsonLd();
  }

  setHomeStructuredData(metadata: PageMetadata, faqs: Array<{ question: string; answer: string }>): void {
    const base = this.config.siteUrl.replace(/\/$/, '');
    this.setJsonLd('software-application', {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'LokaSlip',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: metadata.description,
      url: this.absoluteUrl(metadata.path),
      license: 'https://www.apache.org/licenses/LICENSE-2.0',
    });
    this.setJsonLd('organization', {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'LokaSlip',
      url: base,
    });
    this.setJsonLd('faq-page', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    });
  }

  private setMeta(name: string, content: string, attribute = 'name'): void {
    let element = this.document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
    if (!element) {
      element = this.document.createElement('meta');
      element.setAttribute(attribute, name);
      this.document.head.appendChild(element);
    }
    element.content = content;
  }

  private setCanonical(url: string): void {
    let element = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!element) {
      element = this.document.createElement('link');
      element.rel = 'canonical';
      this.document.head.appendChild(element);
    }
    element.href = url;
  }

  private removeCanonical(): void {
    this.document.head.querySelector('link[rel="canonical"]')?.remove();
  }

  private setAlternates(metadata: PageMetadata, language: 'en' | 'id', homeMetadata?: PageMetadata): void {
    this.removeAlternates();
    const counterpart = homeMetadata?.path ?? (language === 'en' ? metadata.path.replace(/^\//, '/id/') : metadata.path.replace(/^\/id/, ''));
    const paths = language === 'en'
      ? { en: metadata.path, id: counterpart }
      : { en: counterpart || '/', id: metadata.path };
    const values: Array<[string, string]> = [
      ['en', paths.en],
      ['id', paths.id],
      ['x-default', paths.en],
    ];
    for (const [locale, path] of values) {
      const link = this.document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = locale;
      link.href = this.absoluteUrl(path);
      this.document.head.appendChild(link);
    }
  }

  private removeAlternates(): void {
    this.document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((element) => element.remove());
  }

  private setJsonLd(key: string, value: Record<string, unknown>): void {
    let element = this.document.head.querySelector<HTMLScriptElement>(`script[data-landing-jsonld="${key}"]`);
    if (!element) {
      element = this.document.createElement('script');
      element.type = 'application/ld+json';
      element.setAttribute('data-landing-jsonld', key);
      this.document.head.appendChild(element);
    }
    element.textContent = JSON.stringify(value);
  }

  private removeJsonLd(): void {
    this.document.head.querySelectorAll('script[data-landing-jsonld]').forEach((element) => element.remove());
  }

  private absoluteUrl(path: string): string {
    return new URL(path, `${this.config.siteUrl.replace(/\/$/, '')}/`).toString();
  }
}

export function createRuntimeConfigProvider(config: LandingRuntimeConfig): { provide: typeof LANDING_CONFIG; useValue: LandingRuntimeConfig } {
  return { provide: LANDING_CONFIG, useValue: config };
}
