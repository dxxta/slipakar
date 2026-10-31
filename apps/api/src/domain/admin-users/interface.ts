import type { Prisma, User } from '@prisma/client';
import type { RepositoryResponse, ResponseTypeWithMetadata, ResponseTypeWithoutMetadata } from '../../lib/types.js';
import type {
  AdminUserView,
  ListAdminUsersSortBy,
  UpdateAdminUserPayload,
} from './dto.js';

export type UserWithCount = User & { _count?: { projects: number } };

export interface AdminUsersRepositoryInterface {
  listUsers(args: {
    page: number;
    limit: number;
    q?: string;
    sortBy: ListAdminUsersSortBy;
    sortDir: 'asc' | 'desc';
  }): Promise<RepositoryResponse<UserWithCount[]>>;

  findById(id: string): Promise<UserWithCount | null>;

  findByEmail(email: string): Promise<User | null>;

  updateUser(args: {
    id: string;
    payload: UpdateAdminUserPayload;
    auditUserId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<UserWithCount>;

  disableUser(args: {
    id: string;
    reason?: string;
    auditUserId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<UserWithCount>;

  enableUser(args: {
    id: string;
    auditUserId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<UserWithCount>;

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
