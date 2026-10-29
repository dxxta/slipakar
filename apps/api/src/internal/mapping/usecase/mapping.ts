import type { PrismaClient } from '@prisma/client';
import { createMappingDto, getMappingDto, previewMappingDto } from '../../../domain/mapping/dto.js';
import type { MappingUseCaseInterface } from '../../../domain/mapping/interface.js';
import { AppError } from '../../../lib/app-error.js';
import { inTransaction } from '../../../lib/in-transaction.js';
import { validateAndThrow } from '../../../lib/validate-and-throw.js';
import type { MappingRepositoryInterface } from '../../../domain/mapping/interface.js';

export type TemplateEngine = {
  extractPlaceholders(text: string): string[];
  renderTemplate(template: { subject: string; bodyHtml: string }, row: Record<string, string>): { subject: string; body: string };
};

export type MappingUseCaseDeps = {
  repository: MappingRepositoryInterface;
  prisma: PrismaClient;
  engine: TemplateEngine;
  templateLookup(projectId: string, templateId: string): Promise<{ subject: string; bodyHtml: string } | null>;
  uploadLookup(projectId: string, uploadId: string): Promise<{ columns: string[]; rowCount: number } | null>;
  rowLookup(projectId: string, uploadId: string, rowIndex: number): Promise<Record<string, string> | null>;
  projectLookup(projectId: string, userId: string): Promise<boolean>;
  pdfTemplateLookup?(projectId: string, pdfTemplateId: string): Promise<{ placeholders: string[] } | null>;
};

export type MappingValidation = { valid: boolean; unmapped: string[]; unknownColumns: string[] };

export function validateMapping(templatePlaceholders: string[], columns: string[], mapping: Record<string, string>): MappingValidation {
  const unmapped = [...new Set(templatePlaceholders)].filter((name) => !Object.hasOwn(mapping, name) || !mapping[name]);
  const unknownColumns = [...new Set(Object.values(mapping))].filter((column) => !columns.includes(column));
  return { valid: unmapped.length === 0 && unknownColumns.length === 0, unmapped, unknownColumns };
}

export function buildMappingUseCase(deps: MappingUseCaseDeps): MappingUseCaseInterface {
  const assertOwner = async (projectId: string, auditUserId: string): Promise<void> => {
    if (!(await deps.projectLookup(projectId, auditUserId))) throw new AppError(404, 'NOT_FOUND', 'Project not found');
  };
  const getSources = async (projectId: string, templateId: string, uploadId: string): Promise<{
    template: { subject: string; bodyHtml: string };
    upload: { columns: string[]; rowCount: number };
  }> => {
    const [template, upload] = await Promise.all([deps.templateLookup(projectId, templateId), deps.uploadLookup(projectId, uploadId)]);
    if (!template) throw new AppError(404, 'NOT_FOUND', 'Email template not found');
    if (!upload) throw new AppError(404, 'NOT_FOUND', 'Data upload not found');
    return { template, upload };
  };
  const assertMapping = async (
    projectId: string,
    template: { subject: string; bodyHtml: string },
    columns: string[],
    mapping: Record<string, string>,
    pdfTemplateId?: string,
  ): Promise<void> => {
    let placeholders = deps.engine.extractPlaceholders(`${template.subject} ${template.bodyHtml}`);
    if (pdfTemplateId) {
      if (!deps.pdfTemplateLookup) throw new AppError(404, 'NOT_FOUND', 'PDF template lookup not provided');
      const pdfTemplate = await deps.pdfTemplateLookup(projectId, pdfTemplateId);
      if (!pdfTemplate) throw new AppError(404, 'NOT_FOUND', 'PDF template not found');
      placeholders = [...new Set([...placeholders, ...pdfTemplate.placeholders])];
    }
    const result = validateMapping(placeholders, columns, mapping);
    if (!result.valid) throw new AppError(400, 'MAPPING_INVALID', 'Invalid field mapping', { unmapped: result.unmapped, unknownColumns: result.unknownColumns });
  };
  const useCase: MappingUseCaseInterface = {
    async saveMappingUseCase({ projectId, auditUserId, payload }) {
      const body = validateAndThrow({ schema: createMappingDto, data: payload });
      await assertOwner(projectId, auditUserId);
      const { template, upload } = await getSources(projectId, body.templateId, body.uploadId);
      await assertMapping(projectId, template, upload.columns, body.mapping, body.pdfTemplateId);
      const { data } = await inTransaction(deps.prisma, (tx) => deps.repository.upsertMappingRepository({ payload: body, auditUserId, tx }));
      return { message: 'Mapping saved successfully', data, success: true };
    },
    async getMappingUseCase({ projectId, auditUserId, filter }) {
      const body = validateAndThrow({ schema: getMappingDto, data: filter });
      await assertOwner(projectId, auditUserId);
      await getSources(projectId, body.templateId, body.uploadId);
      const { data } = await deps.repository.getMappingRepository({ filter: body });
      if (!data) throw new AppError(404, 'NOT_FOUND', 'Field mapping not found');
      return { message: 'Mapping retrieved successfully', data, success: true };
    },
    async previewMappingUseCase({ projectId, auditUserId, payload }) {
      const body = validateAndThrow({ schema: previewMappingDto, data: payload });
      await assertOwner(projectId, auditUserId);
      const { template, upload } = await getSources(projectId, body.templateId, body.uploadId);
      if (body.row >= upload.rowCount) throw new AppError(400, 'ROW_OUT_OF_RANGE', 'Row is out of range');
      const mapping = body.mapping ?? (await deps.repository.getMappingRepository({ filter: { templateId: body.templateId, uploadId: body.uploadId } })).data?.mapping ?? {};
      await assertMapping(projectId, template, upload.columns, mapping, body.pdfTemplateId);
      const sourceRow = await deps.rowLookup(projectId, body.uploadId, body.row);
      if (!sourceRow) throw new AppError(404, 'NOT_FOUND', 'Row not found');
      const rowData: Record<string, string> = Object.create(null) as Record<string, string>;
      for (const [placeholder, column] of Object.entries(mapping)) {
        const value = sourceRow[column];
        if (value !== undefined) rowData[placeholder] = value;
      }
      return { message: 'Mapping preview generated successfully', data: { ...deps.engine.renderTemplate(template, rowData), row: body.row }, success: true };
    },
  };
  return useCase;
}
