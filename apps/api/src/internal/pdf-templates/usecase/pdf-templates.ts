import type { PrismaClient } from '@prisma/client';
import { createPdfTemplatesDto, listPdfTemplatesQueryDto, updatePdfTemplatesDto } from '../../../domain/pdf-templates/dto.js';
import type {
  PdfNodeTree,
  PdfTemplatesRepositoryInterface,
  PdfTemplatesUseCaseInterface,
} from '../../../domain/pdf-templates/interface.js';
import { AppError } from '../../../lib/app-error.js';
import { inTransaction } from '../../../lib/in-transaction.js';
import { validateAndThrow } from '../../../lib/validate-and-throw.js';

type ProjectLookup = (projectId: string, userId: string) => Promise<boolean>;
type AttachmentLookup = (projectId: string, attachmentId: string) => Promise<boolean>;

export function buildPdfTemplatesUseCase({
  repository,
  prisma,
  projectLookup,
  attachmentLookup,
}: {
  repository: PdfTemplatesRepositoryInterface;
  prisma: PrismaClient;
  projectLookup: ProjectLookup;
  attachmentLookup: AttachmentLookup;
}): PdfTemplatesUseCaseInterface {
  const assertProject = async (projectId: string, auditUserId: string): Promise<void> => {
    if (!(await projectLookup(projectId, auditUserId))) {
      throw new AppError(404, 'NOT_FOUND', 'Project not found');
    }
  };

  const validateImageAttachments = async (projectId: string, tree: PdfNodeTree): Promise<void> => {
    for (const node of tree.nodes) {
      if (node.type === 'image') {
        const exists = await attachmentLookup(projectId, node.attachmentId);
        if (!exists) {
          throw new AppError(400, 'INVALID_IMAGE_ATTACHMENT', `Attachment ${node.attachmentId} not found in project`);
        }
      }
    }
  };

  return {
    async createPdfTemplatesUseCase({ projectId, payload, auditUserId }) {
      const body = validateAndThrow({ schema: createPdfTemplatesDto, data: payload });
      await assertProject(projectId, auditUserId);
      await validateImageAttachments(projectId, body.nodeTree);

      const { data } = await inTransaction(prisma, (tx) =>
        repository.createPdfTemplatesRepository({
          projectId,
          payload: body,
          auditUserId,
          tx,
        }),
      );

      return {
        message: 'PDF template created successfully',
        data,
        success: true,
      };
    },

    async listPdfTemplatesUseCase({ projectId, query, auditUserId }) {
      await assertProject(projectId, auditUserId);
      const params = validateAndThrow({ schema: listPdfTemplatesQueryDto, data: query ?? {} });
      const { data, metadata } = await repository.listPdfTemplatesRepository({
        filter: { projectId, ...(params.q ? { q: params.q } : {}) },
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      });
      return {
        message: 'PDF templates retrieved successfully',
        data,
        metadata: metadata ?? { page: params.page, limit: params.limit, total: data.length },
        success: true,
      };
    },

    async getPdfTemplatesUseCase({ projectId, id, auditUserId }) {
      await assertProject(projectId, auditUserId);
      const { data } = await repository.getPdfTemplatesRepository({ filter: { projectId, id } });
      if (!data) {
        throw new AppError(404, 'NOT_FOUND', 'PDF template not found');
      }
      return {
        message: 'PDF template retrieved successfully',
        data,
        success: true,
      };
    },

    async updatePdfTemplatesUseCase({ projectId, id, payload, auditUserId }) {
      const body = validateAndThrow({ schema: updatePdfTemplatesDto, data: payload });
      await assertProject(projectId, auditUserId);

      if (body.nodeTree) {
        await validateImageAttachments(projectId, body.nodeTree);
      }

      const { data } = await inTransaction(prisma, (tx) =>
        repository.updatePdfTemplatesRepository({
          filter: { projectId, id },
          payload: body,
          auditUserId,
          tx,
        }),
      );

      if (!data) {
        throw new AppError(404, 'NOT_FOUND', 'PDF template not found');
      }

      return {
        message: 'PDF template updated successfully',
        data,
        success: true,
      };
    },

    async deletePdfTemplatesUseCase({ projectId, id, auditUserId }) {
      await assertProject(projectId, auditUserId);

      const count = await repository.countCampaignsUsingTemplateRepository({ pdfTemplateId: id });
      if (count > 0) {
        throw new AppError(409, 'TEMPLATE_IN_USE', 'PDF template is used by one or more campaigns');
      }

      const { data } = await inTransaction(prisma, (tx) =>
        repository.deletePdfTemplatesRepository({
          filter: { projectId, id },
          auditUserId,
          tx,
        }),
      );

      if (!data) {
        throw new AppError(404, 'NOT_FOUND', 'PDF template not found');
      }

      return {
        message: 'PDF template deleted successfully',
        data: null,
        success: true,
      };
    },
  };
}
