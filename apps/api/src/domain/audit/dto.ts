import { z } from 'zod';

export const listActivityQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListActivityQuery = z.infer<typeof listActivityQueryDto>;

export const auditLogViewSchema = z.object({
  id: z.string(),
  entity: z.string(),
  entityId: z.string(),
  action: z.enum(['create', 'update', 'delete', 'read']),
  fieldName: z.string(),
  fieldValue: z.unknown().nullable(),
  userId: z.string(),
  createdAt: z.string().datetime(),
});

export type AuditLogView = z.infer<typeof auditLogViewSchema>;
