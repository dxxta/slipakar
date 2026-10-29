import type { Prisma, PrismaClient, RecipientStatus } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';
import type {
  CampaignDetailView,
  CampaignRecipientView,
  CampaignsRepositoryInterface,
  CampaignView,
} from '../../../domain/campaigns/interface.js';

export function buildCampaignsRepository({
  prisma,
  auditRepository,
}: {
  prisma: PrismaClient;
  auditRepository: AuditRepositoryInterface;
}): CampaignsRepositoryInterface {
  return {
    async createCampaignsRepository({ payload, auditUserId, tx }): Promise<{ data: CampaignView }> {
      const client = tx ?? prisma;
      const campaign = await client.campaign.create({
        data: {
          projectId: payload.projectId,
          emailTemplateId: payload.emailTemplateId,
          pdfTemplateId: payload.pdfTemplateId ?? null,
          smtpConnectionId: payload.smtpConnectionId,
          uploadId: payload.uploadId,
          emailColumn: payload.emailColumn,
          status: 'draft',
        },
      });

      if (payload.recipients.length > 0) {
        await client.campaignRecipient.createMany({
          data: payload.recipients.map((r) => ({
            campaignId: campaign.id,
            email: r.email,
            rowIndex: r.rowIndex,
            status: 'pending' as RecipientStatus,
          })),
        });
      }

      await auditRepository.createAuditRepository({
        entity: 'Campaign',
        entityId: campaign.id,
        action: 'create',
        auditUserId,
        tx,
        changes: [
          { fieldName: 'status', fieldValue: campaign.status },
          { fieldName: 'emailTemplateId', fieldValue: campaign.emailTemplateId },
          { fieldName: 'smtpConnectionId', fieldValue: campaign.smtpConnectionId },
          { fieldName: 'uploadId', fieldValue: campaign.uploadId },
          { fieldName: 'emailColumn', fieldValue: campaign.emailColumn },
        ],
      });

      return { data: campaign };
    },

    async findAllCampaignsRepository({ filter, page, limit, sortBy, sortDir }): Promise<{ data: CampaignView[]; metadata?: { page: number; limit: number; total: number } }> {
      const where: Prisma.CampaignWhereInput = {
        projectId: filter.projectId,
        ...(filter.q ? { status: { contains: filter.q, mode: 'insensitive' } } : {}),
      };
      const skip = (page - 1) * limit;
      const [total, campaigns] = await Promise.all([
        prisma.campaign.count({ where }),
        prisma.campaign.findMany({
          where,
          orderBy: { [sortBy]: sortDir },
          skip,
          take: limit,
        }),
      ]);
      return {
        data: campaigns,
        metadata: { page, limit, total },
      };
    },

    async findByIdCampaignsRepository({ filter }): Promise<{ data: CampaignDetailView | null }> {
      const campaign = await prisma.campaign.findFirst({
        where: { projectId: filter.projectId, id: filter.id },
      });
      if (!campaign) return { data: null };

      const grouped = await prisma.campaignRecipient.groupBy({
        by: ['status'],
        where: { campaignId: campaign.id },
        _count: { _all: true },
      });

      const counts = { pending: 0, sent: 0, failed: 0, total: 0 };
      for (const item of grouped) {
        const count = item._count._all;
        counts.total += count;
        if (item.status === 'pending') counts.pending = count;
        else if (item.status === 'sent') counts.sent = count;
        else if (item.status === 'failed') counts.failed = count;
      }

      return { data: { ...campaign, counts } };
    },

    async findRecipientsCampaignsRepository({
      filter,
      page,
      limit,
      sortBy,
      sortDir,
    }): Promise<{ data: CampaignRecipientView[]; metadata: { total: number } }> {
      const where: Prisma.CampaignRecipientWhereInput = {
        campaignId: filter.campaignId,
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.q ? { email: { contains: filter.q, mode: 'insensitive' } } : {}),
      };

      const [total, data] = await Promise.all([
        prisma.campaignRecipient.count({ where }),
        prisma.campaignRecipient.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sortBy]: sortDir },
        }),
      ]);

      return { data, metadata: { total } };
    },

    async findRecipientByIdCampaignsRepository({
      filter,
    }: {
      filter: { campaignId: string; id: string };
    }): Promise<{ data: CampaignRecipientView | null }> {
      const recipient = await prisma.campaignRecipient.findFirst({
        where: { campaignId: filter.campaignId, id: filter.id },
      });
      return { data: recipient };
    },

    async markSendingCampaignsRepository({ id, auditUserId, tx }): Promise<number> {
      const client = tx ?? prisma;
      const res = await client.campaign.updateMany({
        where: { id, status: 'draft' },
        data: { status: 'sending' },
      });

      if (res.count > 0) {
        await auditRepository.createAuditRepository({
          entity: 'Campaign',
          entityId: id,
          action: 'update',
          auditUserId,
          tx,
          changes: [{ fieldName: 'status', fieldValue: 'sending' }],
        });
      }

      return res.count;
    },

    async revertToDraftCampaignsRepository({ id, auditUserId, tx }): Promise<void> {
      const client = tx ?? prisma;
      const res = await client.campaign.updateMany({
        where: { id },
        data: { status: 'draft' },
      });

      if (res.count > 0) {
        await auditRepository.createAuditRepository({
          entity: 'Campaign',
          entityId: id,
          action: 'update',
          auditUserId,
          tx,
          changes: [{ fieldName: 'status', fieldValue: 'draft' }],
        });
      }
    },

    async resetRecipientCampaignsRepository({ filter, auditUserId, tx }): Promise<CampaignRecipientView | null> {
      const client = tx ?? prisma;
      const updated = await client.campaignRecipient.updateMany({
        where: { campaignId: filter.campaignId, id: filter.id, status: 'failed' },
        data: { status: 'pending', errorMessage: null },
      });

      if (updated.count === 0) return null;

      const record = await client.campaignRecipient.findUnique({
        where: { id: filter.id },
      });

      await auditRepository.createAuditRepository({
        entity: 'CampaignRecipient',
        entityId: filter.id,
        action: 'update',
        auditUserId,
        tx,
        changes: [
          { fieldName: 'status', fieldValue: 'pending' },
          { fieldName: 'errorMessage', fieldValue: null },
        ],
      });

      return record;
    },

    async setCampaignStatusCampaignsRepository({ id, status, auditUserId, tx }): Promise<void> {
      const client = tx ?? prisma;
      await client.campaign.update({
        where: { id },
        data: { status },
      });

      await auditRepository.createAuditRepository({
        entity: 'Campaign',
        entityId: id,
        action: 'update',
        auditUserId,
        tx,
        changes: [{ fieldName: 'status', fieldValue: status }],
      });
    },
  };
}
