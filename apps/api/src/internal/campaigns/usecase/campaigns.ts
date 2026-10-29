import type { PrismaClient } from '@prisma/client';
import { createCampaignsDto, listCampaignsQueryDto, listRecipientsQueryDto } from '../../../domain/campaigns/dto.js';
import type {
  CampaignDetailView,
  CampaignRecipientView,
  CampaignsRepositoryInterface,
  CampaignsUseCaseInterface,
  CampaignView,
} from '../../../domain/campaigns/interface.js';
import type { QueuePublisher } from '../../../domain/queue/interface.js';
import { AppError } from '../../../lib/app-error.js';
import { inTransaction } from '../../../lib/in-transaction.js';
import { validateAndThrow } from '../../../lib/validate-and-throw.js';
import { validateMapping } from '../../mapping/usecase/mapping.js';
import { extractPlaceholders } from '../../templates/renderer/template-renderer.js';

const simpleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type TemplateLookup = (projectId: string, id: string) => Promise<{
  subject: string;
  bodyHtml: string;
} | null>;

type SmtpLookup = (projectId: string, id: string) => Promise<{
  id: string;
} | null>;

type UploadLookup = (projectId: string, id: string) => Promise<{
  columns: string[];
  rows: Record<string, string>[];
} | null>;

type MappingLookup = (
  projectId: string,
  templateId: string,
  uploadId: string,
) => Promise<Record<string, string> | null>;

type ProjectLookup = (projectId: string, userId: string) => Promise<boolean>;

type PdfTemplateLookup = (projectId: string, id: string) => Promise<{
  placeholders: string[];
} | null>;

export function buildCampaignsUseCase({
  repository,
  prisma,
  queue,
  templateLookup,
  smtpLookup,
  uploadLookup,
  mappingLookup,
  projectLookup,
  pdfTemplateLookup,
}: {
  repository: CampaignsRepositoryInterface;
  prisma: PrismaClient;
  queue: QueuePublisher;
  templateLookup: TemplateLookup;
  smtpLookup: SmtpLookup;
  uploadLookup: UploadLookup;
  mappingLookup: MappingLookup;
  projectLookup: ProjectLookup;
  pdfTemplateLookup?: PdfTemplateLookup;
}): CampaignsUseCaseInterface {
  const assertProject = async (projectId: string, auditUserId: string): Promise<void> => {
    if (!(await projectLookup(projectId, auditUserId))) {
      throw new AppError(404, 'NOT_FOUND', 'Project not found');
    }
  };

  return {
    async createCampaignsUseCase({
      projectId,
      payload,
      auditUserId,
    }: {
      projectId: string;
      payload: unknown;
      auditUserId: string;
    }): Promise<{ message: string; data: CampaignView; success: true }> {
      const body = validateAndThrow({ schema: createCampaignsDto, data: payload });
      await assertProject(projectId, auditUserId);

      // Verify template, smtp, upload
      const [template, smtp, upload] = await Promise.all([
        templateLookup(projectId, body.emailTemplateId),
        smtpLookup(projectId, body.smtpConnectionId),
        uploadLookup(projectId, body.uploadId),
      ]);

      if (!template || !smtp || !upload) {
        throw new AppError(404, 'NOT_FOUND', 'Required campaign resources not found');
      }

      let pdfPlaceholders: string[] = [];
      if (body.pdfTemplateId) {
        if (!pdfTemplateLookup) {
          throw new AppError(404, 'NOT_FOUND', 'PDF template lookup not provided');
        }
        const pdfTemplate = await pdfTemplateLookup(projectId, body.pdfTemplateId);
        if (!pdfTemplate) {
          throw new AppError(404, 'NOT_FOUND', 'PDF template not found');
        }
        pdfPlaceholders = pdfTemplate.placeholders;
      }

      // Check emailColumn in upload columns
      if (!upload.columns.includes(body.emailColumn)) {
        throw new AppError(400, 'INVALID_EMAIL_COLUMN', `Email column ${body.emailColumn} not in upload`);
      }

      // Check mapping
      const mapping = await mappingLookup(projectId, body.emailTemplateId, body.uploadId);
      if (!mapping) {
        throw new AppError(400, 'MAPPING_MISSING', 'Mapping not found for template and upload');
      }

      const placeholders = [
        ...new Set([
          ...extractPlaceholders(template.subject),
          ...extractPlaceholders(template.bodyHtml),
          ...pdfPlaceholders,
        ]),
      ];

      const validation = validateMapping(placeholders, upload.columns, mapping);
      if (!validation.valid) {
        throw new AppError(400, 'MAPPING_INVALID', 'Mapping does not resolve all template placeholders');
      }

      // Validate email format for each row
      const invalidRows: number[] = [];
      const recipients: Array<{ email: string; rowIndex: number }> = [];

      upload.rows.forEach((row, rowIndex) => {
        const email = (row[body.emailColumn] ?? '').trim();
        if (!simpleEmailRegex.test(email)) {
          if (invalidRows.length < 20) {
            invalidRows.push(rowIndex);
          }
        } else {
          recipients.push({ email, rowIndex });
        }
      });

      if (invalidRows.length > 0) {
        throw new AppError(400, 'INVALID_RECIPIENT_EMAIL', 'Invalid recipient email format detected', {
          invalidRows,
        });
      }

      // Create campaign and recipients in ONE inTransaction
      const { data: campaign } = await inTransaction(prisma, async (tx) => {
        return repository.createCampaignsRepository({
          payload: {
            projectId,
            emailTemplateId: body.emailTemplateId,
            pdfTemplateId: body.pdfTemplateId,
            smtpConnectionId: body.smtpConnectionId,
            uploadId: body.uploadId,
            emailColumn: body.emailColumn,
            recipients,
          },
          auditUserId,
          tx,
        });
      });

      return {
        message: 'Campaign created successfully',
        data: campaign,
        success: true,
      };
    },

    async findAllCampaignsUseCase({
      projectId,
      query,
      auditUserId,
    }) {
      await assertProject(projectId, auditUserId);
      const params = validateAndThrow({ schema: listCampaignsQueryDto, data: query ?? {} });
      const { data, metadata } = await repository.findAllCampaignsRepository({
        filter: { projectId, ...(params.q ? { q: params.q } : {}) },
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      });
      return {
        message: 'Campaigns retrieved successfully',
        data,
        metadata: metadata ?? { page: params.page, limit: params.limit, total: data.length },
        success: true,
      };
    },

    async findByIdCampaignsUseCase({
      projectId,
      id,
      auditUserId,
    }: {
      projectId: string;
      id: string;
      auditUserId: string;
    }): Promise<{ message: string; data: CampaignDetailView; success: true }> {
      await assertProject(projectId, auditUserId);
      const { data } = await repository.findByIdCampaignsRepository({ filter: { projectId, id } });
      if (!data) {
        throw new AppError(404, 'NOT_FOUND', 'Campaign not found');
      }
      return {
        message: 'Campaign retrieved successfully',
        data,
        success: true,
      };
    },

    async sendCampaignsUseCase({
      projectId,
      id,
      auditUserId,
    }: {
      projectId: string;
      id: string;
      auditUserId: string;
    }): Promise<{ message: string; data: { campaignId: string; status: string; enqueuedCount: number }; success: true }> {
      await assertProject(projectId, auditUserId);

      // Atomically mark sending
      const updatedCount = await inTransaction(prisma, async (tx) => {
        return repository.markSendingCampaignsRepository({ id, auditUserId, tx });
      });

      if (updatedCount === 0) {
        throw new AppError(409, 'CAMPAIGN_ALREADY_SENT', 'Campaign is not in draft status');
      }

      // Fetch pending recipients to enqueue
      const { data: recipients } = await repository.findRecipientsCampaignsRepository({
        filter: { campaignId: id, status: 'pending' },
        page: 1,
        limit: 100_000,
        sortBy: 'rowIndex',
        sortDir: 'asc',
      });

      try {
        for (const recipient of recipients) {
          await queue.publishSendEmail({
            campaignId: id,
            recipientId: recipient.id,
          });
        }
      } catch (publishError) {
        // Revert to draft
        await inTransaction(prisma, async (tx) => {
          await repository.revertToDraftCampaignsRepository({ id, auditUserId, tx });
        });
        throw publishError;
      }

      return {
        message: 'Campaign sending initiated',
        data: {
          campaignId: id,
          status: 'sending',
          enqueuedCount: recipients.length,
        },
        success: true,
      };
    },

    async getRecipientsCampaignsUseCase({
      projectId,
      campaignId,
      query,
      auditUserId,
    }: {
      projectId: string;
      campaignId: string;
      query: unknown;
      auditUserId: string;
    }) {
      const parsedQuery = validateAndThrow({ schema: listRecipientsQueryDto, data: query });
      await assertProject(projectId, auditUserId);

      const res = await repository.findRecipientsCampaignsRepository({
        filter: {
          campaignId,
          ...(parsedQuery.status ? { status: parsedQuery.status } : {}),
          ...(parsedQuery.q ? { q: parsedQuery.q } : {}),
        },
        page: parsedQuery.page,
        limit: parsedQuery.limit,
        sortBy: parsedQuery.sortBy,
        sortDir: parsedQuery.sortDir,
      });

      return {
        message: 'Recipients retrieved successfully',
        data: res.data,
        metadata: {
          page: parsedQuery.page,
          limit: parsedQuery.limit,
          total: res.metadata.total,
        },
        success: true,
      };
    },

    async retryRecipientCampaignsUseCase({
      projectId,
      campaignId,
      recipientId,
      auditUserId,
    }: {
      projectId: string;
      campaignId: string;
      recipientId: string;
      auditUserId: string;
    }): Promise<{ message: string; data: CampaignRecipientView; success: true }> {
      await assertProject(projectId, auditUserId);

      const { data: recipient } = await repository.findRecipientByIdCampaignsRepository({
        filter: { campaignId, id: recipientId },
      });

      if (!recipient) {
        throw new AppError(404, 'NOT_FOUND', 'Recipient not found');
      }

      if (recipient.status !== 'failed') {
        throw new AppError(409, 'NOT_RETRYABLE', 'Recipient is not in failed status');
      }

      const updatedRecipient = await inTransaction(prisma, async (tx) => {
        const reset = await repository.resetRecipientCampaignsRepository({
          filter: { campaignId, id: recipientId },
          auditUserId,
          tx,
        });
        await repository.setCampaignStatusCampaignsRepository({
          id: campaignId,
          status: 'sending',
          auditUserId,
          tx,
        });
        return reset;
      });

      await queue.publishSendEmail({
        campaignId,
        recipientId,
      });

      return {
        message: 'Recipient reset to pending and enqueued',
        data: (updatedRecipient ?? recipient),
        success: true,
      };
    },
  };
}
