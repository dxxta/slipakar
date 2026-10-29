import { describe, expect, it, vi } from 'vitest';
import type { EmailTemplate, Prisma, PrismaClient } from '@prisma/client';
import type { TemplatesRepositoryInterface } from '../../../domain/templates/interface.js';
import { buildTemplatesUseCase } from './templates.js';

const template: EmailTemplate = {
  id: 'template-1',
  projectId: 'project-1',
  name: 'Payslip',
  subject: 'Hello {{name}}',
  bodyHtml: '<p>Hello {{name}}</p>',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const fakeTx = {} as Prisma.TransactionClient;
const prisma = {
  $transaction: async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => fn(fakeTx),
} as PrismaClient;

function makeRepository(overrides: Partial<TemplatesRepositoryInterface> = {}): TemplatesRepositoryInterface {
  return {
    createTemplateRepository: vi.fn().mockResolvedValue({ data: template }),
    listTemplateRepository: vi.fn().mockResolvedValue({ data: [template] }),
    getTemplateRepository: vi.fn().mockResolvedValue({ data: template }),
    updateTemplateRepository: vi.fn().mockResolvedValue({ data: template }),
    deleteTemplateRepository: vi.fn().mockResolvedValue({ data: true }),
    ...overrides,
  };
}

describe('templates usecase', () => {
  it('(1) createTemplateUseCase returns the envelope {message, data, success: true} with the saved template and passes auditUserId and the transaction client to the repository', async () => {
    const repository = makeRepository();
    const useCase = buildTemplatesUseCase({
      repository,
      prisma,
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    const result = await useCase.createTemplateUseCase({
      projectId: 'project-1',
      payload: { name: 'Payslip', subject: 'Hello {{name}}', bodyHtml: '<p>Hello {{name}}</p>' },
      auditUserId: 'user-1',
    });

    expect(result).toEqual({
      message: 'Template created successfully',
      data: {
        id: template.id,
        projectId: template.projectId,
        name: template.name,
        subject: template.subject,
        bodyHtml: template.bodyHtml,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      },
      success: true,
    });
    expect(repository.createTemplateRepository).toHaveBeenCalledOnce();
    expect(repository.createTemplateRepository).toHaveBeenCalledWith({
      projectId: 'project-1',
      payload: { name: 'Payslip', subject: 'Hello {{name}}', bodyHtml: '<p>Hello {{name}}</p>' },
      auditUserId: 'user-1',
      tx: fakeTx,
    });
  });

  it.each([
    { syntax: '{{#each rows}}', payload: { name: 'Payslip', subject: 'Hello {{name}}', bodyHtml: '{{#each rows}}' } },
    { syntax: '{{{raw}}}', payload: { name: 'Payslip', subject: '{{{raw}}}', bodyHtml: '<p>Hello</p>' } },
  ])('(2) create with a body containing $syntax rejects with an error whose status is 400 (code VALIDATION or UNSAFE_TEMPLATE) and the repository is never called', async ({ payload }) => {
    const repository = makeRepository();
    const useCase = buildTemplatesUseCase({
      repository,
      prisma,
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    await expect(
      useCase.createTemplateUseCase({
        projectId: 'project-1',
        payload,
        auditUserId: 'user-1',
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'UNSAFE_TEMPLATE',
    });
    expect(repository.createTemplateRepository).not.toHaveBeenCalled();
  });

  it('(3) create with an empty name rejects with 400 and the repository is never called', async () => {
    const repository = makeRepository();
    const useCase = buildTemplatesUseCase({
      repository,
      prisma,
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    await expect(
      useCase.createTemplateUseCase({
        projectId: 'project-1',
        payload: { name: '   ', subject: 'Hello {{name}}', bodyHtml: '<p>Hello {{name}}</p>' },
        auditUserId: 'user-1',
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION',
    });
    expect(repository.createTemplateRepository).not.toHaveBeenCalled();
  });

  it('(4) when projectLookup returns false every method rejects with AppError status 404 code NOT_FOUND and the repository is never called', async () => {
    const repository = makeRepository();
    const useCase = buildTemplatesUseCase({
      repository,
      prisma,
      projectLookup: vi.fn().mockResolvedValue(false),
    });

    const validCreatePayload = { name: 'Payslip', subject: 'Hello {{name}}', bodyHtml: '<p>Hello</p>' };
    const validUpdatePayload = { name: 'Updated Payslip' };

    await expect(
      useCase.createTemplateUseCase({ projectId: 'project-1', payload: validCreatePayload, auditUserId: 'user-1' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });

    await expect(
      useCase.listTemplateUseCase({ projectId: 'project-1', auditUserId: 'user-1' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });

    await expect(
      useCase.getTemplateUseCase({ projectId: 'project-1', id: 'template-1', auditUserId: 'user-1' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });

    await expect(
      useCase.updateTemplateUseCase({ projectId: 'project-1', id: 'template-1', payload: validUpdatePayload, auditUserId: 'user-1' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });

    await expect(
      useCase.deleteTemplateUseCase({ projectId: 'project-1', id: 'template-1', auditUserId: 'user-1' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });

    expect(repository.createTemplateRepository).not.toHaveBeenCalled();
    expect(repository.listTemplateRepository).not.toHaveBeenCalled();
    expect(repository.getTemplateRepository).not.toHaveBeenCalled();
    expect(repository.updateTemplateRepository).not.toHaveBeenCalled();
    expect(repository.deleteTemplateRepository).not.toHaveBeenCalled();
  });

  it('(5) update with an empty object payload rejects with 400', async () => {
    const repository = makeRepository();
    const useCase = buildTemplatesUseCase({
      repository,
      prisma,
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    await expect(
      useCase.updateTemplateUseCase({
        projectId: 'project-1',
        id: 'template-1',
        payload: {},
        auditUserId: 'user-1',
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION',
    });
    expect(repository.updateTemplateRepository).not.toHaveBeenCalled();
  });

  it('(6) update with an unsafe subject rejects with 400', async () => {
    const repository = makeRepository();
    const useCase = buildTemplatesUseCase({
      repository,
      prisma,
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    await expect(
      useCase.updateTemplateUseCase({
        projectId: 'project-1',
        id: 'template-1',
        payload: { subject: '{{{raw}}}' },
        auditUserId: 'user-1',
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'UNSAFE_TEMPLATE',
    });
    expect(repository.updateTemplateRepository).not.toHaveBeenCalled();
  });

  it('(7) get of a missing template rejects with 404 NOT_FOUND', async () => {
    const repository = makeRepository({
      getTemplateRepository: vi.fn().mockResolvedValue({ data: null }),
    });
    const useCase = buildTemplatesUseCase({
      repository,
      prisma,
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    await expect(
      useCase.getTemplateUseCase({
        projectId: 'project-1',
        id: 'missing-id',
        auditUserId: 'user-1',
      }),
    ).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Template not found',
    });
    expect(repository.getTemplateRepository).toHaveBeenCalledWith({
      filter: { projectId: 'project-1', id: 'missing-id' },
    });
  });

  it('(8) delete returns success true and calls the repository delete once with auditUserId', async () => {
    const repository = makeRepository();
    const useCase = buildTemplatesUseCase({
      repository,
      prisma,
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    const result = await useCase.deleteTemplateUseCase({
      projectId: 'project-1',
      id: 'template-1',
      auditUserId: 'user-1',
    });

    expect(result).toEqual({
      message: 'Template deleted successfully',
      data: null,
      success: true,
    });
    expect(repository.deleteTemplateRepository).toHaveBeenCalledOnce();
    expect(repository.deleteTemplateRepository).toHaveBeenCalledWith({
      filter: { projectId: 'project-1', id: 'template-1' },
      auditUserId: 'user-1',
      tx: fakeTx,
    });
  });

  it('(9) list returns an array in data with the envelope', async () => {
    const repository = makeRepository({
      listTemplateRepository: vi.fn().mockResolvedValue({
        data: [template],
        metadata: { page: 1, limit: 20, total: 1 },
      }),
    });
    const useCase = buildTemplatesUseCase({
      repository,
      prisma,
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    const result = await useCase.listTemplateUseCase({
      projectId: 'project-1',
      query: { page: '1', limit: '20', q: 'Pay', sortBy: 'name', sortDir: 'asc' },
      auditUserId: 'user-1',
    });

    expect(result).toEqual({
      message: 'Templates retrieved successfully',
      data: [
        {
          id: template.id,
          projectId: template.projectId,
          name: template.name,
          subject: template.subject,
          bodyHtml: template.bodyHtml,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
        },
      ],
      metadata: { page: 1, limit: 20, total: 1 },
      success: true,
    });
    expect(repository.listTemplateRepository).toHaveBeenCalledWith({
      filter: { projectId: 'project-1', q: 'Pay' },
      page: 1,
      limit: 20,
      sortBy: 'name',
      sortDir: 'asc',
    });
  });
});
