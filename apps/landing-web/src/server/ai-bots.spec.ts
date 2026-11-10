import { describe, expect, it } from 'vitest';
import { BLOCKED_AI_BOTS, isBlockedAiBot } from './ai-bots';

describe('AI bot blocking', () => {
  it.each(BLOCKED_AI_BOTS)('blocks %s case-insensitively', (bot) => {
    expect(isBlockedAiBot(`Mozilla/5.0 (${bot.toLowerCase()})`)).toBe(true);
  });

  it.each(['Googlebot', 'Bingbot', 'DuckDuckBot', 'OAI-SearchBot', 'PerplexityBot', 'Claude-SearchBot', 'DuckAssistBot'])('allows search agent %s', (agent) => {
    expect(isBlockedAiBot(agent)).toBe(false);
  });

  it('allows browsers and an empty user agent', () => {
    expect(isBlockedAiBot('Mozilla/5.0 Chrome/130.0 Safari/537.36')).toBe(false);
    expect(isBlockedAiBot('')).toBe(false);
  });
});
