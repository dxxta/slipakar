import { BLOCKED_AI_BOTS } from './ai-bots';

export function buildRobotsTxt(siteUrl: string): string {
  const blockedRules = BLOCKED_AI_BOTS.map((bot) => `User-agent: ${bot}\nDisallow: /`).join('\n\n');
  return `${blockedRules}\n\nUser-agent: *\nAllow: /\n\nSitemap: ${siteUrl.replace(/\/$/, '')}/sitemap.xml\n`;
}
