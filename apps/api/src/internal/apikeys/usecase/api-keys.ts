import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../../lib/app-error.js';
import { inTransaction } from '../../../lib/in-transaction.js';
import { validateAndThrow } from '../../../lib/validate-and-throw.js';
import { createApiKeyDto } from '../../../domain/apikeys/dto.js';
import type { ApiKeysRepositoryInterface, ApiKeysUseCaseInterface } from '../../../domain/apikeys/interface.js';
import { API_KEY_SCOPES } from '../../../domain/system-config/dto.js';

export function buildApiKeysUseCase({ repository, prisma, projectLookup, isActive, now = () => new Date() }: { repository: ApiKeysRepositoryInterface; prisma: PrismaClient; projectLookup: (projectId: string, userId: string) => Promise<boolean>; isActive: () => Promise<boolean>; now?: () => Date }): ApiKeysUseCaseInterface {
  const assertAvailable = async (projectId: string, userId: string): Promise<void> => {
    if (!(await isActive())) throw new AppError(404, 'NOT_FOUND', 'Resource not found');
    if (!(await projectLookup(projectId, userId))) throw new AppError(404, 'NOT_FOUND', 'Project not found');
  };
  return {
    async list({ projectId, userId }) {
      await assertAvailable(projectId, userId);
      return { message: 'API keys retrieved successfully', data: await repository.listApiKeys(projectId), success: true };
    },
    async create({ projectId, userId, payload }) {
      await assertAvailable(projectId, userId);
      const body = validateAndThrow({ schema: createApiKeyDto, data: payload });
      const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
      if (expiresAt && expiresAt <= now()) throw new AppError(400, 'VALIDATION', 'Expiry must be in the future');
      if ((await repository.countActiveApiKeys(projectId, now())) >= 10) throw new AppError(400, 'API_KEY_LIMIT', 'A project can have at most 10 active API keys');
      const id = randomBytes(6).toString('base64url').slice(0, 8);
      const secret = `slp_${id}_${randomBytes(32).toString('base64url')}`;
      const keyHash = createHash('sha256').update(secret).digest('hex');
      const created = await inTransaction(prisma, (tx) => repository.createApiKey({ data: { id, projectId, createdByUserId: userId, name: body.name, prefix: id.slice(0, 8), keyHash, scopes: body.scopes, expiresAt }, auditUserId: userId, tx }));
      return { message: 'API key created successfully. Copy it now; it will not be shown again.', data: { ...created, secret }, success: true };
    },
    async revoke({ projectId, userId, id }) {
      await assertAvailable(projectId, userId);
      const item = await inTransaction(prisma, (tx) => repository.revokeApiKey({ id, projectId, auditUserId: userId, tx }));
      if (!item) throw new AppError(404, 'NOT_FOUND', 'API key not found');
      return { message: 'API key revoked successfully', data: item, success: true };
    },
  };
}
