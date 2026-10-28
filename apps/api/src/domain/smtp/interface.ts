import type { Prisma, SmtpConnection } from '@prisma/client';
import type { RepositoryResponse, ResponseTypeWithMetadata, ResponseTypeWithoutMetadata } from '../../lib/types.js';
import type { ListSmtpSortBy, SmtpInput } from './dto.js';

export type SmtpView = Omit<SmtpConnection, 'passwordEncrypted'>;
export type SmtpCreateData = Pick<SmtpConnection, 'host' | 'port' | 'username' | 'passwordEncrypted' | 'secure' | 'fromAddress'>;
export type SmtpUpdateData = Partial<SmtpCreateData>;
export type SmtpFilter = { projectId: string; id?: string; q?: string };
export type SmtpSenderInterface = {
  verify(config: SmtpInput): Promise<{ ok: true } | { ok: false; error: string }>;
  sendMail(
    config: SmtpInput,
    mail: {
      from: string;
      to: string;
      subject: string;
      html: string;
      attachments?: { filename: string; content: Buffer; contentType: string }[];
    },
  ): Promise<{ ok: true } | { ok: false; error: string; transient: boolean }>;
};

export interface SmtpRepositoryInterface {
  createSmtpRepository(args: { projectId: string; payload: SmtpCreateData; auditUserId: string; tx?: Prisma.TransactionClient }): Promise<RepositoryResponse<SmtpConnection>>;
  listSmtpRepository(args: {
    filter: SmtpFilter;
    page: number;
    limit: number;
    sortBy: ListSmtpSortBy;
    sortDir: 'asc' | 'desc';
  }): Promise<RepositoryResponse<SmtpConnection[]>>;
  getSmtpRepository(args: { filter: Required<Pick<SmtpFilter, 'projectId' | 'id'>> }): Promise<RepositoryResponse<SmtpConnection | null>>;
  updateSmtpRepository(args: { filter: Required<Pick<SmtpFilter, 'projectId' | 'id'>>; payload: SmtpUpdateData; auditUserId: string; tx?: Prisma.TransactionClient }): Promise<RepositoryResponse<SmtpConnection | null>>;
  deleteSmtpRepository(args: { filter: Required<Pick<SmtpFilter, 'projectId' | 'id'>>; auditUserId: string; tx?: Prisma.TransactionClient }): Promise<RepositoryResponse<boolean>>;
}

export interface SmtpUseCaseInterface {
  createSmtpUseCase(args: { projectId: string; payload: unknown; auditUserId: string }): Promise<ResponseTypeWithoutMetadata<SmtpView>>;
  listSmtpUseCase(args: { projectId: string; query?: unknown; auditUserId: string }): Promise<ResponseTypeWithMetadata<SmtpView[]>>;
  getSmtpUseCase(args: { projectId: string; id: string; auditUserId: string }): Promise<ResponseTypeWithoutMetadata<SmtpView>>;
  updateSmtpUseCase(args: { projectId: string; id: string; payload: unknown; auditUserId: string }): Promise<ResponseTypeWithoutMetadata<SmtpView>>;
  deleteSmtpUseCase(args: { projectId: string; id: string; auditUserId: string }): Promise<ResponseTypeWithoutMetadata<null>>;
  testSmtpUseCase(args: { projectId: string; id: string; auditUserId: string }): Promise<ResponseTypeWithoutMetadata<{ ok: true } | { ok: false; error: string }>>;
}
