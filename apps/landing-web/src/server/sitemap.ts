export const INDEXABLE_PATHS = ['/', '/id', '/terms', '/id/terms'] as const;

export function buildSitemapXml(siteUrl: string): string {
  const origin = siteUrl.replace(/\/$/, '');
  const entries = INDEXABLE_PATHS.map((path) => `<url><loc>${escapeXml(`${origin}${path}`)}</loc></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
