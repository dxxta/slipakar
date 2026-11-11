import { z } from 'zod';

export const SYSTEM_CONFIG_KEYS = ['scalar_docs', 'pdf_builder', 'self_signup', 'api_access_enabled', 'embed_enabled'] as const;

export const systemConfigKeySchema = z.enum(SYSTEM_CONFIG_KEYS);
export type SystemConfigKey = z.infer<typeof systemConfigKeySchema>;

export const updateSystemConfigDto = z.strictObject({
  value: z.boolean(),
});
export type UpdateSystemConfigPayload = z.infer<typeof updateSystemConfigDto>;

export const API_KEY_SCOPES = ['templates:read', 'templates:write', 'uploads:read', 'uploads:write', 'mappings:read', 'mappings:write', 'campaigns:read', 'campaigns:write', 'campaigns:send', 'recipients:read', 'smtp:read', 'embed:create'] as const;
export type ApiKeyScope = typeof API_KEY_SCOPES[number];
