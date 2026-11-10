import type { Attachment, Prisma } from '@prisma/client';
import type { RepositoryResponse, ResponseTypeWithoutMetadata } from '../../lib/types.js';

export type AttachmentView = Omit<Attachment, 'objectKey' | 'sizeBytes'> & {
  sizeBytes: string;
};

export type AttachmentRecord = Attachment;

export type StorageUsageView = {
  usedBytes: string;
  quotaBytes: string;
};

export type AttachmentFilter = {
  projectId: string;
  id?: string;
  campaignId?: string;
};

export type AttachmentCreateData = {
  projectId: string;
  campaignId?: string | null;
  objectKey: string;
  fileName: string;
  sizeBytes: bigint;
  kind: string;
};

export interface AttachmentsRepositoryInterface {
  createAttachmentsRepository(args: {
    payload: AttachmentCreateData;
    tx?: Prisma.TransactionClient;
    auditUserId: string;
  }): Promise<RepositoryResponse<AttachmentView>>;
  findAllAttachmentsRepository(args: {
    filter: AttachmentFilter;
  }): Promise<RepositoryResponse<AttachmentView[]>>;
  findByIdAttachmentsRepository(args: {
    filter: AttachmentFilter;
  }): Promise<RepositoryResponse<AttachmentRecord | null>>;
  deleteAttachmentsRepository(args: {
    payload: AttachmentFilter;
    tx?: Prisma.TransactionClient;
    auditUserId: string;
  }): Promise<RepositoryResponse<boolean>>;
  sumSizeAttachmentsRepository(args: {
    filter: { projectId: string };
    tx?: Prisma.TransactionClient;
  }): Promise<bigint>;
}

export type AttachmentsFileInput = {
  buffer: Buffer;
  fileName: string;
  contentType: string;
};

export interface AttachmentsUseCaseInterface {
  assertProjectAttachmentsUseCase(args: { projectId: string; auditUserId: string }): Promise<void>;
  createAttachmentsUseCase(args: {
    projectId: string;
    file: AttachmentsFileInput;
    payload: unknown;
    auditUserId: string;
  }): Promise<ResponseTypeWithoutMetadata<AttachmentView>>;
  findAllAttachmentsUseCase(args: {
    projectId: string;
    campaignId?: string;
    auditUserId: string;
  }): Promise<ResponseTypeWithoutMetadata<AttachmentView[]>>;
  findByIdAttachmentsUseCase(args: {
    projectId: string;
    id: string;
    auditUserId: string;
  }): Promise<ResponseTypeWithoutMetadata<AttachmentView>>;
  getContentAttachmentsUseCase(args: {
    projectId: string;
    id: string;
    auditUserId: string;
  }): Promise<{ buffer: Buffer; fileName: string; contentType: string; inline: boolean }>;
  deleteAttachmentsUseCase(args: {
    projectId: string;
    id: string;
    auditUserId: string;
  }): Promise<ResponseTypeWithoutMetadata<null>>;
  getStorageUsageUseCase(args: {
    projectId: string;
    auditUserId: string;
  }): Promise<ResponseTypeWithoutMetadata<StorageUsageView>>;
}
