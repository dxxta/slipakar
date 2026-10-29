import { z } from 'zod';

export const listTemplatesSortByEnum = z.enum(['name', 'subject', 'createdAt', 'updatedAt']);
export type ListTemplatesSortBy = z.infer<typeof listTemplatesSortByEnum>;

export const listTemplatesQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).optional(),
  sortBy: listTemplatesSortByEnum.default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type ListTemplatesQuery = z.infer<typeof listTemplatesQueryDto>;

export const createTemplateDto = z.strictObject({
  name: z.string().trim().min(1).max(100),
  subject: z.string().trim().min(1).max(300),
  bodyHtml: z.string().min(1).max(200_000),
});
export const updateTemplateDto = createTemplateDto.partial().refine((value) => Object.keys(value).length > 0);
export type CreateTemplatePayload = z.infer<typeof createTemplateDto>;
export type UpdateTemplatePayload = z.infer<typeof updateTemplateDto>;
