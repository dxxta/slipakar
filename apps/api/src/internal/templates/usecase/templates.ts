import type { EmailTemplate, PrismaClient } from '@prisma/client';
import { createTemplateDto, listTemplatesQueryDto, updateTemplateDto } from '../../../domain/templates/dto.js';
import type { TemplatesRepositoryInterface, TemplatesUseCaseInterface, TemplateView } from '../../../domain/templates/interface.js';
import { AppError } from '../../../lib/app-error.js';
import { inTransaction } from '../../../lib/in-transaction.js';
import { validateAndThrow } from '../../../lib/validate-and-throw.js';
import { assertSafeTemplate } from '../renderer/template-renderer.js';

const toView = (record: EmailTemplate): TemplateView => ({
  id: record.id, projectId: record.projectId, name: record.name,
  subject: record.subject, bodyHtml: record.bodyHtml,
  createdAt: record.createdAt, updatedAt: record.updatedAt,
});

export function buildTemplatesUseCase({ repository, prisma, projectLookup }: {
  repository: TemplatesRepositoryInterface;
  prisma: PrismaClient;
  projectLookup: (projectId: string, userId: string) => Promise<boolean>;
}): TemplatesUseCaseInterface {
  const assertOwner = async (projectId: string, userId: string): Promise<void> => {
    if (!(await projectLookup(projectId, userId))) throw new AppError(404, 'NOT_FOUND', 'Project not found');
  };
  const getRecord = async (projectId: string, id: string): Promise<EmailTemplate> => {
    const { data } = await repository.getTemplateRepository({ filter: { projectId, id } });
    if (!data) throw new AppError(404, 'NOT_FOUND', 'Template not found');
    return data;
  };
  return {
    async createTemplateUseCase({ projectId, payload, auditUserId }) {
      const body = validateAndThrow({ schema: createTemplateDto, data: payload });
      await assertOwner(projectId, auditUserId);
      assertSafeTemplate(body.subject);
      assertSafeTemplate(body.bodyHtml);
      const { data } = await inTransaction(prisma, (tx) => repository.createTemplateRepository({ projectId, payload: body, auditUserId, tx }));
      return { message: 'Template created successfully', data: toView(data), success: true };
    },
    async listTemplateUseCase({ projectId, query, auditUserId }) {
      await assertOwner(projectId, auditUserId);
      const params = validateAndThrow({ schema: listTemplatesQueryDto, data: query ?? {} });
      const { data, metadata } = await repository.listTemplateRepository({
        filter: { projectId, ...(params.q ? { q: params.q } : {}) },
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      });
      return {
        message: 'Templates retrieved successfully',
        data: data.map(toView),
        metadata: metadata ?? { page: params.page, limit: params.limit, total: data.length },
        success: true,
      };
    },
    async getTemplateUseCase({ projectId, id, auditUserId }) {
      await assertOwner(projectId, auditUserId);
      return { message: 'Template retrieved successfully', data: toView(await getRecord(projectId, id)), success: true };
    },
    async updateTemplateUseCase({ projectId, id, payload, auditUserId }) {
      const body = validateAndThrow({ schema: updateTemplateDto, data: payload });
      await assertOwner(projectId, auditUserId);
      if (body.subject !== undefined) assertSafeTemplate(body.subject);
      if (body.bodyHtml !== undefined) assertSafeTemplate(body.bodyHtml);
      const { data } = await inTransaction(prisma, (tx) => repository.updateTemplateRepository({ filter: { projectId, id }, payload: body, auditUserId, tx }));
      if (!data) throw new AppError(404, 'NOT_FOUND', 'Template not found');
      return { message: 'Template updated successfully', data: toView(data), success: true };
    },
    async deleteTemplateUseCase({ projectId, id, auditUserId }) {
      await assertOwner(projectId, auditUserId);
      const { data } = await inTransaction(prisma, (tx) => repository.deleteTemplateRepository({ filter: { projectId, id }, auditUserId, tx }));
      if (!data) throw new AppError(404, 'NOT_FOUND', 'Template not found');
      return { message: 'Template deleted successfully', data: null, success: true };
    },
  };
}
