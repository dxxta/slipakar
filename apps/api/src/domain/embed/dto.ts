import { z } from 'zod';

export const EMBED_SCOPES = [
  'templates:read',
  'templates:write',
  'uploads:read',
  'uploads:write',
  'mappings:read',
  'mappings:write',
  'campaigns:read',
  'campaigns:write',
  'campaigns:send',
  'recipients:read',
] as const;

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const embedThemeDto = z.strictObject({
  mode: z.enum(['light', 'dark', 'system']).optional(),
  accent: hexColor.optional(),
  secondary: hexColor.optional(),
  third: hexColor.optional(),
  style: z.enum(['styled', 'unstyled']).optional(),
});

export const createEmbedTokenDto = z.strictObject({
  parentOrigin: z.string().url().refine((value) => {
    const url = new URL(value);
    return url.origin === value.replace(/\/$/, '') && !url.username && !url.password;
  }, 'parentOrigin must be an absolute origin'),
  scopes: z.array(z.enum(EMBED_SCOPES)).min(1).optional(),
  theme: embedThemeDto.optional(),
});

export const exchangeEmbedTokenDto = z.strictObject({
  token: z.string().regex(/^slpl_[A-Za-z0-9_-]{43}$/),
});

export type EmbedScope = typeof EMBED_SCOPES[number];
export type EmbedTheme = z.infer<typeof embedThemeDto>;
export type CreateEmbedTokenPayload = z.infer<typeof createEmbedTokenDto>;
export type ExchangeEmbedTokenPayload = z.infer<typeof exchangeEmbedTokenDto>;
