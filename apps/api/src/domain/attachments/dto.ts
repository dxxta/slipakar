import { z } from 'zod';

export const attachmentKindEnum = z.enum(['extra', 'generated']);
export type AttachmentKind = z.infer<typeof attachmentKindEnum>;

export const createAttachmentsDto = z.object({
  kind: attachmentKindEnum.default('extra'),
  campaignId: z.string().uuid().optional(),
});
export type CreateAttachmentsPayload = z.infer<typeof createAttachmentsDto>;

export const listAttachmentsQueryDto = z.object({
  campaignId: z.string().uuid().optional(),
});
export type ListAttachmentsQuery = z.infer<typeof listAttachmentsQueryDto>;
