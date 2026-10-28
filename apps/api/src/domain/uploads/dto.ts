import { z } from 'zod';

export const createUploadsDto = z.object({
  fileName: z.string().trim().min(1).max(255),
  buffer: z.instanceof(Buffer),
});
export type CreateUploadsPayload = z.infer<typeof createUploadsDto>;
