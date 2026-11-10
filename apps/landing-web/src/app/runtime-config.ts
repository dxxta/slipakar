import { DOCUMENT } from '@angular/common';
import { InjectionToken, REQUEST_CONTEXT, inject } from '@angular/core';

export interface LandingRuntimeConfig {
  appUrl: string;
  siteUrl: string;
  repoUrl: string;
  docsUrl: string;
}

export const DEFAULT_LANDING_CONFIG: LandingRuntimeConfig = {
  appUrl: 'http://localhost:8080',
  siteUrl: 'http://localhost:8082',
  repoUrl: 'http://localhost:8082/#open-source',
  docsUrl: 'http://localhost:8082/#self-host',
};

export function createLandingRuntimeConfig(environment: Readonly<Record<string, string | undefined>>): LandingRuntimeConfig {
  const siteUrl = safeAbsoluteUrl(environment['LANDING_SITE_URL'], DEFAULT_LANDING_CONFIG.siteUrl).replace(/\/$/, '');
  return {
    appUrl: safeAbsoluteUrl(environment['LANDING_APP_URL'], DEFAULT_LANDING_CONFIG.appUrl),
    siteUrl,
    repoUrl: safeAbsoluteUrl(environment['LANDING_REPO_URL'], `${siteUrl}/#open-source`),
    docsUrl: safeAbsoluteUrl(environment['LANDING_DOCS_URL'], `${siteUrl}/#self-host`),
  };
}

export function landingAllowedHosts(config: LandingRuntimeConfig): string[] {
  const configuredHost = new URL(config.siteUrl).hostname;
  return [...new Set([configuredHost, 'localhost', '127.0.0.1'])];
}

export function applyRuntimeConfigToHtml(html: string, config: LandingRuntimeConfig): string {
  const serializedConfig = escapeHtmlAttribute(JSON.stringify(config));
  const configMeta = `<meta name="landing-runtime-config" content="${serializedConfig}" />`;
  const configPattern = /<meta\s+name="landing-runtime-config"\s+content="[^"]*"\s*\/?\s*>/i;
  const withConfig = configPattern.test(html)
    ? html.replace(configPattern, configMeta)
    : html.replace('</head>', `${configMeta}</head>`);
  return withConfig
    .replaceAll(DEFAULT_LANDING_CONFIG.appUrl, config.appUrl)
    .replaceAll(DEFAULT_LANDING_CONFIG.siteUrl, config.siteUrl)
    .replaceAll(DEFAULT_LANDING_CONFIG.repoUrl, config.repoUrl)
    .replaceAll(DEFAULT_LANDING_CONFIG.docsUrl, config.docsUrl);
}

export const LANDING_CONFIG = new InjectionToken<LandingRuntimeConfig>('LANDING_CONFIG', {
  providedIn: 'root',
  factory: () => {
    const context = inject(REQUEST_CONTEXT, { optional: true }) as { landingConfig?: LandingRuntimeConfig } | null;
    return context?.landingConfig ?? readLandingConfigFromDocument(inject(DOCUMENT));
  },
});

export function readLandingConfigFromDocument(document: Document): LandingRuntimeConfig {
  const serialized = document.querySelector<HTMLMetaElement>('meta[name="landing-runtime-config"]')?.content;
  if (!serialized) return DEFAULT_LANDING_CONFIG;

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_LANDING_CONFIG;
    const value = parsed as Partial<LandingRuntimeConfig>;
    return createLandingRuntimeConfig({
      LANDING_APP_URL: value.appUrl,
      LANDING_SITE_URL: value.siteUrl,
      LANDING_REPO_URL: value.repoUrl,
      LANDING_DOCS_URL: value.docsUrl,
    });
  } catch {
    return DEFAULT_LANDING_CONFIG;
  }
}

function safeAbsoluteUrl(value: string | undefined, fallback: string): string {
  if (!value?.trim()) return fallback;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString().replace(/\/$/, '') : fallback;
  } catch {
    return fallback;
  }
}

function escapeHtmlAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
