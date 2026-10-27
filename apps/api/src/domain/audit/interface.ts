import type { Prisma } from '@prisma/client';
import type { RepositoryResponse, ResponseTypeWithMetadata } from '../../lib/types.js';
import type { AuditLogView } from './dto.js';

export type AuditChange = { fieldName: string; fieldValue: unknown };

export type CreateAuditPayload = {
  entity: string;
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'read';
  changes: AuditChange[];
  auditUserId: string;
  tx?: Prisma.TransactionClient;
};

export type AuditRecord = {
  id: string;
  entity: string;
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'read';
  fieldName: string;
  fieldValue: unknown;
  userId: string;
  createdAt: Date;
};

export interface AuditRepositoryInterface {
  createAuditRepository(payload: CreateAuditPayload): Promise<{ data: { count: number } }>;
  findActivityByProjectRepository(args: {
    projectId: string;
    page: number;
    limit: number;
  }): Promise<RepositoryResponse<AuditRecord[]>>;
}

export interface AuditUseCaseInterface {
  listProjectActivityUseCase(args: {
    projectId: string;
    query: unknown;
    auditUserId: string;
  }): Promise<ResponseTypeWithMetadata<AuditLogView[]>>;
}
