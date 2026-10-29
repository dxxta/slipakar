import type { Campaign, CampaignRecipient, Prisma, RecipientStatus } from '@prisma/client';
import type { RepositoryResponse, ResponseTypeWithMetadata, ResponseTypeWithoutMetadata } from '../../lib/types.js';
import type { ListCampaignsSortBy, ListRecipientsSortBy } from './dto.js';

export type RecipientCounts = {
  pending: number;
  sent: number;
  failed: number;
  total: number;
};

export type CampaignView = Campaign;

export type CampaignDetailView = Campaign & {
  counts: RecipientCounts;
};

export type CampaignRecipientView = CampaignRecipient;

export type CampaignFilter = {
  projectId: string;
  id?: string;
  q?: string;
};

export type CreateCampaignsData = {
  projectId: string;
  emailTemplateId: string;
  pdfTemplateId?: string | null;
  smtpConnectionId: string;
  uploadId: string;
  emailColumn: string;
  recipients: Array<{
    email: string;
    rowIndex: number;
  }>;
};

export type FindRecipientsFilter = {
  campaignId: string;
  status?: RecipientStatus;
  q?: string;
};

export interface CampaignsRepositoryInterface {
  createCampaignsRepository(args: {
    payload: CreateCampaignsData;
    auditUserId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<RepositoryResponse<CampaignView>>;

  findAllCampaignsRepository(args: {
    filter: CampaignFilter;
    page: number;
    limit: number;
    sortBy: ListCampaignsSortBy;
    sortDir: 'asc' | 'desc';
  }): Promise<RepositoryResponse<CampaignView[]>>;

  findByIdCampaignsRepository(args: {
    filter: CampaignFilter;
  }): Promise<RepositoryResponse<CampaignDetailView | null>>;

  findRecipientsCampaignsRepository(args: {
    filter: FindRecipientsFilter;
    page: number;
    limit: number;
    sortBy: ListRecipientsSortBy;
    sortDir: 'asc' | 'desc';
  }): Promise<{ data: CampaignRecipientView[]; metadata: { total: number } }>;

  findRecipientByIdCampaignsRepository(args: {
    filter: { campaignId: string; id: string };
  }): Promise<RepositoryResponse<CampaignRecipientView | null>>;

  markSendingCampaignsRepository(args: {
    id: string;
    auditUserId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<number>;

  revertToDraftCampaignsRepository(args: {
    id: string;
    auditUserId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<void>;

  resetRecipientCampaignsRepository(args: {
    filter: { campaignId: string; id: string };
    auditUserId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<CampaignRecipientView | null>;

  setCampaignStatusCampaignsRepository(args: {
    id: string;
    status: string;
    auditUserId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<void>;
}

export type SendCampaignResult = {
  campaignId: string;
  status: string;
  enqueuedCount: number;
};

export interface CampaignsUseCaseInterface {
  createCampaignsUseCase(args: {
    projectId: string;
    payload: unknown;
    auditUserId: string;
  }): Promise<ResponseTypeWithoutMetadata<CampaignView>>;

  findAllCampaignsUseCase(args: {
    projectId: string;
    query?: unknown;
    auditUserId: string;
  }): Promise<ResponseTypeWithMetadata<CampaignView[]>>;

  findByIdCampaignsUseCase(args: {
    projectId: string;
    id: string;
    auditUserId: string;
  }): Promise<ResponseTypeWithoutMetadata<CampaignDetailView>>;

  sendCampaignsUseCase(args: {
    projectId: string;
    id: string;
    auditUserId: string;
  }): Promise<ResponseTypeWithoutMetadata<SendCampaignResult>>;

  getRecipientsCampaignsUseCase(args: {
    projectId: string;
    campaignId: string;
    query: unknown;
    auditUserId: string;
  }): Promise<ResponseTypeWithMetadata<CampaignRecipientView[]>>;

  retryRecipientCampaignsUseCase(args: {
    projectId: string;
    campaignId: string;
    recipientId: string;
    auditUserId: string;
  }): Promise<ResponseTypeWithoutMetadata<CampaignRecipientView>>;
}
