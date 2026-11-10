import { describe, expect, it } from 'vitest';
import { BLOCKED_AI_BOTS } from './ai-bots';
import { buildRobotsTxt } from './robots';

describe('robots.txt', () => {
  it('disallows the same bot list and leaves honest search crawling enabled', () => {
    const robots = buildRobotsTxt('https://landing.example');

    for (const bot of BLOCKED_AI_BOTS) {
      expect(robots).toContain(`User-agent: ${bot}\nDisallow: /`);
    }
    expect(robots).toContain('User-agent: *\nAllow: /');
    expect(robots).toContain('Sitemap: https://landing.example/sitemap.xml');
  });
});
