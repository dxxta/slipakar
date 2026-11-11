import type { ApiKey, Prisma } from '@prisma/client';
import type { ApiKeyScope } from '../system-config/dto.js';
import type { ResponseTypeWithoutMetadata } from '../../lib/types.js';

export type ApiKeyView = Pick<ApiKey, 'id' | 'projectId' | 'name' | 'prefix' | 'scopes' | 'expiresAt' | 'revokedAt' | 'lastUsedAt' | 'createdAt'>;
export type CreatedApiKeyView = ApiKeyView & { secret: string };
export interface ApiKeysRepositoryInterface {
  listApiKeys(projectId: string): Promise<ApiKeyView[]>;
  countActiveApiKeys(projectId: string, now: Date): Promise<number>;
  findByPrefix(prefix: string): Promise<(ApiKey & { project: { owner: { id: string; email: string; role: string; disabledAt: Date | null; disabledReason: string | null } } }) | null>;
  createApiKey(input: { data: Omit<ApiKey, 'createdAt' | 'revokedAt' | 'lastUsedAt'>; auditUserId: string; tx?: Prisma.TransactionClient }): Promise<ApiKeyView>;
  revokeApiKey(input: { id: string; projectId: string; auditUserId: string; tx?: Prisma.TransactionClient }): Promise<ApiKeyView | null>;
  touchApiKey(id: string, now: Date): Promise<void>;
}
export interface ApiKeysUseCaseInterface {
  list(input: { projectId: string; userId: string }): Promise<ResponseTypeWithoutMetadata<ApiKeyView[]>>;
  create(input: { projectId: string; userId: string; payload: unknown }): Promise<ResponseTypeWithoutMetadata<CreatedApiKeyView>>;
  revoke(input: { projectId: string; userId: string; id: string }): Promise<ResponseTypeWithoutMetadata<ApiKeyView>>;
}
export type ApiKeyAuthIdentity = { id: string; email: string; role: string; disabledAt?: Date | null; disabledReason?: string | null };
export type ApiKeyScopeValue = ApiKeyScope;
