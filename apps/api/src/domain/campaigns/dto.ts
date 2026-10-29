import { z } from 'zod';

export const createCampaignsDto = z.strictObject({
  emailTemplateId: z.string().trim().min(1),
  pdfTemplateId: z.string().trim().min(1).optional(),
  smtpConnectionId: z.string().trim().min(1),
  uploadId: z.string().trim().min(1),
  emailColumn: z.string().trim().min(1),
});

export type CreateCampaignsPayload = z.infer<typeof createCampaignsDto>;

export const recipientStatusEnum = z.enum(['pending', 'sent', 'failed']);
export type RecipientStatusType = z.infer<typeof recipientStatusEnum>;

export const listRecipientsSortByEnum = z.enum(['rowIndex', 'email', 'status', 'createdAt', 'updatedAt']);
export type ListRecipientsSortBy = z.infer<typeof listRecipientsSortByEnum>;

export const listRecipientsQueryDto = z.object({
  status: recipientStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).optional(),
  sortBy: listRecipientsSortByEnum.default('rowIndex'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

export type ListRecipientsQuery = z.infer<typeof listRecipientsQueryDto>;

export const listCampaignsSortByEnum = z.enum(['status', 'createdAt', 'updatedAt']);
export type ListCampaignsSortBy = z.infer<typeof listCampaignsSortByEnum>;

export const listCampaignsQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).optional(),
  sortBy: listCampaignsSortByEnum.default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export type ListCampaignsQuery = z.infer<typeof listCampaignsQueryDto>;
