import type { EmailTemplate, Prisma } from '@prisma/client';
import type { RepositoryResponse, ResponseTypeWithMetadata, ResponseTypeWithoutMetadata } from '../../lib/types.js';
import type { CreateTemplatePayload, ListTemplatesSortBy, UpdateTemplatePayload } from './dto.js';

export type TemplateView = Pick<EmailTemplate, 'id' | 'projectId' | 'name' | 'subject' | 'bodyHtml' | 'createdAt' | 'updatedAt'>;
export type TemplateFilter = { projectId: string; id?: string; q?: string };

export interface TemplatesRepositoryInterface {
  createTemplateRepository(args: { projectId: string; payload: CreateTemplatePayload; auditUserId: string; tx?: Prisma.TransactionClient }): Promise<RepositoryResponse<EmailTemplate>>;
  listTemplateRepository(args: {
    filter: TemplateFilter;
    page: number;
    limit: number;
    sortBy: ListTemplatesSortBy;
    sortDir: 'asc' | 'desc';
  }): Promise<RepositoryResponse<EmailTemplate[]>>;
  getTemplateRepository(args: { filter: Required<Pick<TemplateFilter, 'projectId' | 'id'>> }): Promise<RepositoryResponse<EmailTemplate | null>>;
  updateTemplateRepository(args: { filter: Required<Pick<TemplateFilter, 'projectId' | 'id'>>; payload: UpdateTemplatePayload; auditUserId: string; tx?: Prisma.TransactionClient }): Promise<RepositoryResponse<EmailTemplate | null>>;
  deleteTemplateRepository(args: { filter: Required<Pick<TemplateFilter, 'projectId' | 'id'>>; auditUserId: string; tx?: Prisma.TransactionClient }): Promise<RepositoryResponse<boolean>>;
}

export interface TemplatesUseCaseInterface {
  createTemplateUseCase(args: { projectId: string; payload: unknown; auditUserId: string }): Promise<ResponseTypeWithoutMetadata<TemplateView>>;
  listTemplateUseCase(args: { projectId: string; query?: unknown; auditUserId: string }): Promise<ResponseTypeWithMetadata<TemplateView[]>>;
  getTemplateUseCase(args: { projectId: string; id: string; auditUserId: string }): Promise<ResponseTypeWithoutMetadata<TemplateView>>;
  updateTemplateUseCase(args: { projectId: string; id: string; payload: unknown; auditUserId: string }): Promise<ResponseTypeWithoutMetadata<TemplateView>>;
  deleteTemplateUseCase(args: { projectId: string; id: string; auditUserId: string }): Promise<ResponseTypeWithoutMetadata<null>>;
}
