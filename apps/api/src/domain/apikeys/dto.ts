import { z } from 'zod';
import { API_KEY_SCOPES } from '../system-config/dto.js';

export const createApiKeyDto = z.strictObject({
  name: z.string().trim().min(1).max(100),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1),
  expiresAt: z.string().datetime().optional(),
});
export type CreateApiKeyPayload = z.infer<typeof createApiKeyDto>;
