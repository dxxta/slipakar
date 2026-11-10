import type { PrismaClient } from '@prisma/client';
import { createAttachmentsDto } from '../../../domain/attachments/dto.js';
import type {
  AttachmentsFileInput,
  AttachmentsRepositoryInterface,
  AttachmentsUseCaseInterface,
  StorageUsageView,
} from '../../../domain/attachments/interface.js';
import type { StorageInterface } from '../../../domain/storage/interface.js';
import { AppError } from '../../../lib/app-error.js';
import { validateAndThrow } from '../../../lib/validate-and-throw.js';
import { buildAttachmentStore, toAttachmentView } from '../attachment-store.js';
import { buildAuditRepository } from '../../audit/repository/audit.js';

type ProjectLookup = (projectId: string, userId: string) => Promise<boolean>;
type QuotaLookup = (projectId: string, userId: string) => Promise<{ storageQuotaBytes: bigint } | null>;

export function buildAttachmentsUseCase({
  repository,
  prisma,
  storage,
  projectLookup,
  quotaLookup,
}: {
  repository: AttachmentsRepositoryInterface;
  prisma: PrismaClient;
  storage: StorageInterface;
  projectLookup: ProjectLookup;
  quotaLookup: QuotaLookup;
}): AttachmentsUseCaseInterface {
  const store = buildAttachmentStore({
    prisma,
    storage,
    auditRepository: buildAuditRepository(prisma),
    repository,
  });

  const assertProject = async (projectId: string, auditUserId: string): Promise<void> => {
    if (!(await projectLookup(projectId, auditUserId))) {
      throw new AppError(404, 'NOT_FOUND', 'Project not found');
    }
  };

  const getQuota = async (projectId: string, auditUserId: string): Promise<{ storageQuotaBytes: bigint }> => {
    const quota = await quotaLookup(projectId, auditUserId);
    if (!quota) {
      throw new AppError(404, 'NOT_FOUND', 'Project not found');
    }
    return quota;
  };

  return {
    async assertProjectAttachmentsUseCase({ projectId, auditUserId }): Promise<void> {
      await assertProject(projectId, auditUserId);
    },

    async createAttachmentsUseCase({
      projectId,
      file,
      payload,
      auditUserId,
    }: {
      projectId: string;
      file: AttachmentsFileInput;
      payload: unknown;
      auditUserId: string;
    }) {
      const body = validateAndThrow({ schema: createAttachmentsDto, data: payload });
      await assertProject(projectId, auditUserId);
      const quota = await getQuota(projectId, auditUserId);

      if (body.campaignId) {
        const campaign = await prisma.campaign.findFirst({
          where: { id: body.campaignId, projectId },
        });
        if (!campaign) {
          throw new AppError(404, 'NOT_FOUND', 'Campaign not found');
        }
      }

      const created = await store.storeAttachment({
        projectId,
        campaignId: body.campaignId,
        fileName: file.fileName,
        buffer: file.buffer,
        contentType: file.contentType,
        kind: body.kind,
        auditUserId,
        quotaBytes: quota.storageQuotaBytes,
      });

      return {
        message: 'Attachment created successfully',
        data: created,
        success: true,
      };
    },

    async findAllAttachmentsUseCase({ projectId, campaignId, auditUserId }) {
      await assertProject(projectId, auditUserId);
      const { data } = await repository.findAllAttachmentsRepository({
        filter: { projectId, campaignId },
      });
      return {
        message: 'Attachments retrieved successfully',
        data,
        success: true,
      };
    },

    async findByIdAttachmentsUseCase({ projectId, id, auditUserId }) {
      await assertProject(projectId, auditUserId);
      const { data } = await repository.findByIdAttachmentsRepository({ filter: { projectId, id } });
      if (!data) {
        throw new AppError(404, 'NOT_FOUND', 'Attachment not found');
      }
      return {
        message: 'Attachment retrieved successfully',
        data: toAttachmentView(data),
        success: true,
      };
    },

    async getContentAttachmentsUseCase({ projectId, id, auditUserId }) {
      await assertProject(projectId, auditUserId);
      const { data } = await repository.findByIdAttachmentsRepository({ filter: { projectId, id } });
      if (!data) {
        throw new AppError(404, 'NOT_FOUND', 'Attachment not found');
      }
      const extension = data.fileName.split('.').pop()?.toLowerCase() ?? '';
      const imageTypes: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
      const imageType = imageTypes[extension];
      return {
        buffer: await storage.getObject(data.objectKey),
        fileName: data.fileName,
        contentType: imageType ?? 'application/octet-stream',
        inline: imageType !== undefined,
      };
    },

    async deleteAttachmentsUseCase({ projectId, id, auditUserId }) {
      await assertProject(projectId, auditUserId);
      await store.removeAttachment({ id, projectId, auditUserId });

      return {
        message: 'Attachment deleted successfully',
        data: null,
        success: true,
      };
    },

    async getStorageUsageUseCase({ projectId, auditUserId }): Promise<{
      message: string;
      data: StorageUsageView;
      success: true;
    }> {
      await assertProject(projectId, auditUserId);
      const quota = await getQuota(projectId, auditUserId);
      const used = await repository.sumSizeAttachmentsRepository({ filter: { projectId } });

      return {
        message: 'Storage usage retrieved successfully',
        data: {
          usedBytes: used.toString(),
          quotaBytes: quota.storageQuotaBytes.toString(),
        },
        success: true,
      };
    },
  };
}
