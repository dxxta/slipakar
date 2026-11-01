import { z } from 'zod';

export const listUserNoticesQueryDto = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true')
    .or(z.boolean().default(false)),
});

export type ListUserNoticesQueryDto = z.infer<typeof listUserNoticesQueryDto>;

export const userNoticeViewDto = z.strictObject({
  id: z.string().uuid().or(z.string().min(1)),
  userId: z.string().uuid().or(z.string().min(1)),
  broadcastId: z.string().nullable().optional(),
  title: z.string(),
  message: z.string(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type UserNoticeView = z.infer<typeof userNoticeViewDto>;
