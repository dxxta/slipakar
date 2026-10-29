import type { FieldMapping, Prisma } from '@prisma/client';
import type { RepositoryResponse, ResponseTypeWithoutMetadata } from '../../lib/types.js';
import type { CreateMappingPayload, GetMappingPayload } from './dto.js';

export type MappingView = Omit<Pick<FieldMapping, 'id' | 'templateId' | 'uploadId' | 'mapping'>, 'mapping'> & { mapping: Record<string, string> };
export type PreviewView = { subject: string; body: string; row: number };

export interface MappingRepositoryInterface {
  upsertMappingRepository(input: { payload: CreateMappingPayload; auditUserId: string; tx?: Prisma.TransactionClient }): Promise<RepositoryResponse<MappingView>>;
  getMappingRepository(input: { filter: GetMappingPayload }): Promise<RepositoryResponse<MappingView | null>>;
}

export interface MappingUseCaseInterface {
  saveMappingUseCase(input: { projectId: string; auditUserId: string; payload: unknown }): Promise<ResponseTypeWithoutMetadata<MappingView>>;
  getMappingUseCase(input: { projectId: string; auditUserId: string; filter: unknown }): Promise<ResponseTypeWithoutMetadata<MappingView>>;
  previewMappingUseCase(input: { projectId: string; auditUserId: string; payload: unknown }): Promise<ResponseTypeWithoutMetadata<PreviewView>>;
}
