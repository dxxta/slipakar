export const BLOCKED_AI_BOTS = [
  'GPTBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'Claude-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
  'Amazonbot',
  'meta-externalagent',
  'FacebookBot',
  'cohere-ai',
  'Diffbot',
  'ImagesiftBot',
  'Omgilibot',
  'YouBot',
  'MistralAI-User',
  'Timpibot',
  'Perplexity-User',
] as const;

export function isBlockedAiBot(userAgent: string | string[] | undefined): boolean {
  const value = Array.isArray(userAgent) ? userAgent.join(' ') : userAgent ?? '';
  const normalized = value.toLowerCase();
  return BLOCKED_AI_BOTS.some((bot) => normalized.includes(bot.toLowerCase()));
}
