import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { MappingRepositoryInterface } from '../../../domain/mapping/interface.js';
import { buildMappingUseCase, validateMapping } from './mapping.js';

const engine = {
  extractPlaceholders: (text: string): string[] => [...text.matchAll(/{{(\w+)}}/g)].map((match) => match[1]),
  renderTemplate: (template: { subject: string; bodyHtml: string }, row: Record<string, string>): { subject: string; body: string } => ({
    subject: template.subject.replace('{{name}}', row.name), body: template.bodyHtml.replace('{{city}}', row.city),
  }),
};
const template = { subject: 'Hello {{name}}', bodyHtml: '<p>{{city}}</p>' };
const upload = { columns: ['full_name', 'location'], rowCount: 2 };
const rows = [{ full_name: 'Ada', location: 'London' }, { full_name: 'Lin', location: 'Paris' }];
const mapping = { name: 'full_name', city: 'location' };

function makeUseCase(owner = true): ReturnType<typeof buildMappingUseCase> {
  let saved: { mapping: Record<string, string> } | null = null;
  const repository = {
    upsertMappingRepository: async ({ payload }: { payload: { mapping: Record<string, string> } }) => {
      saved = { mapping: payload.mapping };
      return { data: saved };
    },
    getMappingRepository: async () => ({ data: saved }),
  } as unknown as MappingRepositoryInterface;
  return buildMappingUseCase({
    repository, prisma: {} as PrismaClient, engine,
    projectLookup: async () => owner,
    templateLookup: async () => template,
    uploadLookup: async () => upload,
    rowLookup: async (_projectId: string, _uploadId: string, row: number) => rows[row] ?? null,
  });
}

describe('validateMapping', () => {
  it('reports missing placeholders and unknown columns', () => {
    expect(validateMapping(['name', 'city'], ['full_name'], { name: 'missing' })).toEqual({
      valid: false, unmapped: ['city'], unknownColumns: ['missing'],
    });
  });
});

describe('mapping usecase', () => {
  it('rejects an incomplete mapping with details', async () => {
    await expect(makeUseCase().saveMappingUseCase({ projectId: 'p1', auditUserId: 'u1', payload: { templateId: 't1', uploadId: 'd1', mapping: { name: 'full_name' } } }))
      .rejects.toMatchObject({ status: 400, code: 'MAPPING_INVALID', details: { unmapped: ['city'], unknownColumns: [] } });
  });

  it('previews a selected row', async () => {
    const result = await makeUseCase().previewMappingUseCase({ projectId: 'p1', auditUserId: 'u1', payload: { templateId: 't1', uploadId: 'd1', row: 1, mapping } });
    expect(result).toEqual({ message: 'Mapping preview generated successfully', success: true, data: { subject: 'Hello Lin', body: '<p>Paris</p>', row: 1 } });
  });

  it('rejects a row outside the upload', async () => {
    await expect(makeUseCase().previewMappingUseCase({ projectId: 'p1', auditUserId: 'u1', payload: { templateId: 't1', uploadId: 'd1', row: 2, mapping } }))
      .rejects.toMatchObject({ status: 400, code: 'ROW_OUT_OF_RANGE' });
  });

  it('validates union of email and PDF placeholders when pdfTemplateId is present', async () => {
    let saved: { mapping: Record<string, string> } | null = null;
    const repository = {
      upsertMappingRepository: async ({ payload }: { payload: { mapping: Record<string, string> } }) => {
        saved = { mapping: payload.mapping };
        return { data: saved };
      },
      getMappingRepository: async () => ({ data: saved }),
    } as unknown as MappingRepositoryInterface;

    const useCaseWithPdf = buildMappingUseCase({
      repository,
      prisma: {
        $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({}),
      } as unknown as PrismaClient,
      engine,
      projectLookup: async () => true,
      templateLookup: async () => template, // has placeholders: name, city
      uploadLookup: async () => ({ columns: ['full_name', 'location', 'dept_col'], rowCount: 2 }),
      rowLookup: async () => null,
      pdfTemplateLookup: async (_pId, id) => (id === 'pdf-1' ? { placeholders: ['department'] } : null),
    });

    // Incomplete: missing 'department' from PDF template
    await expect(
      useCaseWithPdf.saveMappingUseCase({
        projectId: 'p1',
        auditUserId: 'u1',
        payload: {
          templateId: 't1',
          uploadId: 'd1',
          pdfTemplateId: 'pdf-1',
          mapping: { name: 'full_name', city: 'location' },
        },
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'MAPPING_INVALID',
      details: { unmapped: ['department'] },
    });

    // When pdf template is not found
    await expect(
      useCaseWithPdf.saveMappingUseCase({
        projectId: 'p1',
        auditUserId: 'u1',
        payload: {
          templateId: 't1',
          uploadId: 'd1',
          pdfTemplateId: 'missing-pdf',
          mapping: { name: 'full_name', city: 'location', department: 'dept_col' },
        },
      }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });

    // Complete: has name, city and department
    const savedRes = await useCaseWithPdf.saveMappingUseCase({
      projectId: 'p1',
      auditUserId: 'u1',
      payload: {
        templateId: 't1',
        uploadId: 'd1',
        pdfTemplateId: 'pdf-1',
        mapping: { name: 'full_name', city: 'location', department: 'dept_col' },
      },
    });
    expect(savedRes.success).toBe(true);
  });
});
