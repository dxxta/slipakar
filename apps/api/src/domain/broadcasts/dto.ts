import { z } from 'zod';

export const BROADCAST_AUDIENCES = ['all', 'role', 'users'] as const;
export type BroadcastAudience = (typeof BROADCAST_AUDIENCES)[number];

export const BROADCAST_STATUSES = ['draft', 'sent'] as const;
export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number];

export const BROADCAST_SORT_FIELDS = ['createdAt', 'subject', 'status', 'sentAt'] as const;

export const createBroadcastDto = z
  .strictObject({
    subject: z.string().trim().min(1).max(255),
    bodyText: z.string().trim().min(1).max(10000),
    audience: z.enum(BROADCAST_AUDIENCES).default('all'),
    audienceFilter: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.audience === 'role') {
      const role = data.audienceFilter?.role;
      if (typeof role !== 'string' || role.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "audienceFilter.role must be a non-empty string when audience is 'role'",
          path: ['audienceFilter', 'role'],
        });
      }
    } else if (data.audience === 'users') {
      const userIds = data.audienceFilter?.userIds;
      if (
        !Array.isArray(userIds) ||
        userIds.length === 0 ||
        userIds.length > 1000 ||
        !userIds.every((id) => typeof id === 'string' && id.trim().length > 0)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "audienceFilter.userIds must be a non-empty array of strings (max 1000) when audience is 'users'",
          path: ['audienceFilter', 'userIds'],
        });
      }
    }
  });

export type CreateBroadcastDto = z.infer<typeof createBroadcastDto>;

export const updateBroadcastDto = z
  .strictObject({
    subject: z.string().trim().min(1).max(255).optional(),
    bodyText: z.string().trim().min(1).max(10000).optional(),
    audience: z.enum(BROADCAST_AUDIENCES).optional(),
    audienceFilter: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (data) =>
      data.subject !== undefined ||
      data.bodyText !== undefined ||
      data.audience !== undefined ||
      data.audienceFilter !== undefined,
    {
      message: 'At least one field must be provided for update',
    },
  )
  .superRefine((data, ctx) => {
    if (data.audience === 'role') {
      const role = data.audienceFilter?.role;
      if (typeof role !== 'string' || role.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "audienceFilter.role must be a non-empty string when audience is 'role'",
          path: ['audienceFilter', 'role'],
        });
      }
    } else if (data.audience === 'users') {
      const userIds = data.audienceFilter?.userIds;
      if (
        !Array.isArray(userIds) ||
        userIds.length === 0 ||
        userIds.length > 1000 ||
        !userIds.every((id) => typeof id === 'string' && id.trim().length > 0)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "audienceFilter.userIds must be a non-empty array of strings (max 1000) when audience is 'users'",
          path: ['audienceFilter', 'userIds'],
        });
      }
    }
  });

export type UpdateBroadcastDto = z.infer<typeof updateBroadcastDto>;

export const listBroadcastsQueryDto = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(BROADCAST_SORT_FIELDS).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  q: z.string().trim().optional(),
});

export type ListBroadcastsQueryDto = z.infer<typeof listBroadcastsQueryDto>;

export const broadcastCountsDto = z.strictObject({
  total: z.number().int().default(0),
  sent: z.number().int().default(0),
  failed: z.number().int().default(0),
  emailSkipped: z.boolean().optional(),
});

export type BroadcastCounts = z.infer<typeof broadcastCountsDto>;

export const broadcastViewDto = z.strictObject({
  id: z.string().uuid().or(z.string().min(1)),
  subject: z.string(),
  bodyText: z.string(),
  audience: z.string(),
  audienceFilter: z.record(z.string(), z.unknown()).nullable(),
  status: z.string(),
  sentAt: z.string().datetime().nullable(),
  createdBy: z.string(),
  counts: broadcastCountsDto,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type BroadcastView = z.infer<typeof broadcastViewDto>;

export const broadcastPreviewDto = z.strictObject({
  recipientCount: z.number().int(),
  sampleEmails: z.array(z.string()),
  renderedSubject: z.string(),
  renderedBodyText: z.string(),
});

export type BroadcastPreview = z.infer<typeof broadcastPreviewDto>;

export function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) return email;
  const name = email.slice(0, atIndex);
  const domain = email.slice(atIndex);

  if (name.length <= 1) {
    return `${name}***${domain}`;
  }
  if (name.length === 2) {
    return `${name[0]}*${name[1]}${domain}`;
  }
  return `${name[0]}***${name[name.length - 1]}${domain}`;
}
