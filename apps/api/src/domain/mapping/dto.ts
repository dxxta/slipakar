import { z } from 'zod';

const mappingRecordDto = z.record(z.string().trim().min(1), z.string().trim().min(1));

export const createMappingDto = z.strictObject({
  templateId: z.string().trim().min(1),
  uploadId: z.string().trim().min(1),
  pdfTemplateId: z.string().trim().min(1).optional(),
  mapping: mappingRecordDto,
});

export const updateMappingDto = createMappingDto.partial().refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const previewMappingDto = z.strictObject({
  templateId: z.string().trim().min(1),
  uploadId: z.string().trim().min(1),
  pdfTemplateId: z.string().trim().min(1).optional(),
  row: z.number().int().min(0),
  mapping: mappingRecordDto.optional(),
});

export const getMappingDto = z.strictObject({
  templateId: z.string().trim().min(1),
  uploadId: z.string().trim().min(1),
});

export type CreateMappingPayload = z.infer<typeof createMappingDto>;
export type UpdateMappingPayload = z.infer<typeof updateMappingDto>;
export type PreviewMappingPayload = z.infer<typeof previewMappingDto>;
export type GetMappingPayload = z.infer<typeof getMappingDto>;
