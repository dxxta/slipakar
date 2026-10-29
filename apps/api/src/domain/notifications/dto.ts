import { z } from 'zod';

export const listNotificationsSortByEnum = z.enum(['type', 'createdAt', 'readAt']);
export type ListNotificationsSortBy = z.infer<typeof listNotificationsSortByEnum>;

export const listNotificationsQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unread: z.enum(['true', 'false']).optional(),
  q: z.string().trim().min(1).optional(),
  sortBy: listNotificationsSortByEnum.default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQueryDto>;

export const notificationViewSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  campaignId: z.string().nullable(),
  type: z.string(),
  message: z.string(),
  createdAt: z.string().datetime(),
  readAt: z.string().datetime().nullable(),
});

export const notificationCountSchema = z.object({ count: z.number().int().nonnegative() });
