import { z } from 'zod';

export const listSmtpSortByEnum = z.enum(['host', 'port', 'username', 'fromAddress', 'createdAt', 'updatedAt']);
export type ListSmtpSortBy = z.infer<typeof listSmtpSortByEnum>;

export const listSmtpQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).optional(),
  sortBy: listSmtpSortByEnum.default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type ListSmtpQuery = z.infer<typeof listSmtpQueryDto>;

export const createSmtpDto = z.strictObject({
  host: z.string().trim().min(1),
  port: z.number().int().min(1).max(65535),
  username: z.string().trim().min(1),
  password: z.string().min(1),
  secure: z.boolean(),
  fromAddress: z.string().trim().email().max(254),
});
export const updateSmtpDto = createSmtpDto.partial().refine((value) => Object.keys(value).length > 0);
export type SmtpInput = z.infer<typeof createSmtpDto>;
export type SmtpUpdateInput = z.infer<typeof updateSmtpDto>;
