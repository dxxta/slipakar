import { z } from 'zod';

export const SYSTEM_CONFIG_KEYS = ['scalar_docs', 'pdf_builder', 'self_signup'] as const;

export const systemConfigKeySchema = z.enum(SYSTEM_CONFIG_KEYS);
export type SystemConfigKey = z.infer<typeof systemConfigKeySchema>;

export const updateSystemConfigDto = z.strictObject({
  value: z.boolean(),
});
export type UpdateSystemConfigPayload = z.infer<typeof updateSystemConfigDto>;
