import { z } from 'zod';

export const listProjectsSortByEnum = z.enum(['name', 'createdAt', 'updatedAt']);
export type ListProjectsSortBy = z.infer<typeof listProjectsSortByEnum>;

export const listProjectsQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).optional(),
  sortBy: listProjectsSortByEnum.default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export type ListProjectsQuery = z.infer<typeof listProjectsQueryDto>;

export const createProjectsDto = z.strictObject({
  name: z.string().trim().min(1).max(100),
});

export const updateProjectsDto = z.strictObject({
  name: z.string().trim().min(1).max(100),
  rateLimitPerMinute: z.number().int().min(1).max(600),
  maxUploadBytes: z.number().int().min(1).max(52_428_800),
  maxRows: z.number().int().min(1).max(100_000),
  storageQuotaBytes: z.number().int().positive(),
}).partial().refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export type CreateProjectsPayload = z.infer<typeof createProjectsDto>;
export type UpdateProjectsPayload = z.infer<typeof updateProjectsDto>;
