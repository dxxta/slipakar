import { z } from 'zod';

export const LOGIN_EVENT_USER_SORT_FIELDS = ['createdAt', 'country', 'browser', 'os'] as const;
export const LOGIN_EVENT_ADMIN_SORT_FIELDS = [
  'createdAt',
  'country',
  'browser',
  'os',
  'userEmail',
] as const;

export const listLoginActivityQueryDto = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(LOGIN_EVENT_USER_SORT_FIELDS).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  q: z.string().trim().optional(),
});

export type ListLoginActivityQueryDto = z.infer<typeof listLoginActivityQueryDto>;

export const listAdminLoginActivityQueryDto = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(LOGIN_EVENT_ADMIN_SORT_FIELDS).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  q: z.string().trim().optional(),
});

export type ListAdminLoginActivityQueryDto = z.infer<typeof listAdminLoginActivityQueryDto>;

export const loginContextPayloadDto = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000).optional(),
});

export type LoginContextPayloadDto = z.infer<typeof loginContextPayloadDto>;

export const loginEventViewDto = z.strictObject({
  id: z.string().uuid().or(z.string().min(1)),
  userId: z.string().uuid().or(z.string().min(1)),
  ip: z.string().nullable(),
  proxy: z.boolean(),
  browser: z.string().nullable(),
  os: z.string().nullable(),
  deviceType: z.string().nullable(),
  country: z.string().nullable(),
  region: z.string().nullable(),
  city: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  createdAt: z.string().datetime(),
  userEmail: z.string().optional(),
  userName: z.string().optional(),
});

export type LoginEventView = z.infer<typeof loginEventViewDto>;
