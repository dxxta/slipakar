import type { DataUpload, Prisma } from '@prisma/client';
import type { RepositoryResponse, ResponseTypeWithoutMetadata } from '../../lib/types.js';

export type UploadView = Omit<DataUpload, 'rows' | 'columns'> & { columns: string[] };
export type UploadPreviewView = UploadView & { preview: Record<string, string>[] };
export type ParsedDataFile = { columns: string[]; rows: Record<string, string>[] };
export type ParseDataFileInput = { buffer: Buffer; fileName: string; maxRows: number };
export type FileParserInterface = { parseDataFile(input: ParseDataFileInput): Promise<ParsedDataFile> };
export type UploadFilter = { projectId: string; id?: string };
export type UploadCreatePayload = { projectId: string; fileName: string; columns: string[]; rows: Record<string, string>[] };

export interface UploadsRepositoryInterface {
  createUploadsRepository(args: { payload: UploadCreatePayload; tx?: Prisma.TransactionClient; auditUserId: string }): Promise<RepositoryResponse<UploadView>>;
  findAllUploadsRepository(args: { filter: UploadFilter }): Promise<RepositoryResponse<UploadView[]>>;
  findByIdUploadsRepository(args: { filter: UploadFilter }): Promise<RepositoryResponse<UploadView | null>>;
  getRowsUploadsRepository(args: { filter: UploadFilter }): Promise<RepositoryResponse<Record<string, string>[] | null>>;
  deleteUploadsRepository(args: { payload: UploadFilter; tx?: Prisma.TransactionClient; auditUserId: string }): Promise<RepositoryResponse<boolean>>;
}

export interface UploadsUseCaseInterface {
  assertProjectUploadsUseCase(args: { projectId: string; auditUserId: string }): Promise<void>;
  createUploadsUseCase(args: { projectId: string; payload: unknown; auditUserId: string }): Promise<ResponseTypeWithoutMetadata<UploadView>>;
  findAllUploadsUseCase(args: { projectId: string; auditUserId: string }): Promise<ResponseTypeWithoutMetadata<UploadView[]>>;
  findByIdUploadsUseCase(args: { projectId: string; id: string; auditUserId: string }): Promise<ResponseTypeWithoutMetadata<UploadPreviewView>>;
  deleteUploadsUseCase(args: { projectId: string; id: string; auditUserId: string }): Promise<ResponseTypeWithoutMetadata<null>>;
}
