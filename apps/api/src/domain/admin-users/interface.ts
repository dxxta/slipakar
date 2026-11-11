import type { Prisma, User } from '@prisma/client';
import type { RepositoryResponse, ResponseTypeWithMetadata, ResponseTypeWithoutMetadata } from '../../lib/types.js';
import type {
  AdminUserView,
  ListAdminUsersSortBy,
  UpdateAdminUserPayload,
} from './dto.js';

export interface AdminUsersRepositoryInterface {
  listUsers(args: {
    page: number;
    limit: number;
    q?: string;
    sortBy: ListAdminUsersSortBy;
    sortDir: 'asc' | 'desc';
  }): Promise<RepositoryResponse<User[]>>;

  findById(id: string): Promise<User | null>;

  findByEmail(email: string): Promise<User | null>;

  updateUser(args: {
    id: string;
    payload: UpdateAdminUserPayload;
    auditUserId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<User>;

  disableUser(args: {
    id: string;
    reason?: string;
    auditUserId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<User>;

  enableUser(args: {
    id: string;
    auditUserId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<User>;

  countActiveAdmins(adminEmails: string[]): Promise<number>;
}

export interface AdminUsersUseCaseInterface {
  listUsers(args: {
    query: unknown;
    auditUserId: string;
  }): Promise<ResponseTypeWithMetadata<AdminUserView[]>>;

  getUser(args: {
    id: string;
    auditUserId: string;
  }): Promise<ResponseTypeWithoutMetadata<AdminUserView>>;

  updateUser(args: {
    id: string;
    payload: unknown;
    auditUserId: string;
  }): Promise<ResponseTypeWithoutMetadata<AdminUserView>>;

  disableUser(args: {
    id: string;
    payload: unknown;
    auditUserId: string;
  }): Promise<ResponseTypeWithoutMetadata<AdminUserView>>;

  enableUser(args: {
    id: string;
    auditUserId: string;
  }): Promise<ResponseTypeWithoutMetadata<AdminUserView>>;
}
