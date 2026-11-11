import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { ApiKeysRepositoryInterface, ApiKeyView } from '../../../domain/apikeys/interface.js';
import { buildApiKeysUseCase } from './api-keys.js';

const view: ApiKeyView = { id: 'abcdefgh', projectId: 'project-1', name: 'Example', prefix: 'abcdefgh', scopes: ['templates:read'], expiresAt: null, revokedAt: null, lastUsedAt: null, createdAt: new Date() };
function fixture(active = true) {
  const repo = { listApiKeys: vi.fn().mockResolvedValue([view]), countActiveApiKeys: vi.fn().mockResolvedValue(0), createApiKey: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...view, ...data })), revokeApiKey: vi.fn().mockResolvedValue(view) };
  const prisma = { $transaction: async <T>(callback: (tx: object) => Promise<T>) => callback({}) };
  const useCase = buildApiKeysUseCase({ repository: repo as unknown as ApiKeysRepositoryInterface, prisma: prisma as never, projectLookup: async () => true, isActive: async () => active });
  return { repo, useCase };
}

describe('API key usecase', () => {
  it('stores only a SHA-256 hash and returns the generated secret only in the create response', async () => {
    const { repo, useCase } = fixture();
    const result = await useCase.create({ projectId: 'project-1', userId: 'owner-1', payload: { name: 'Example', scopes: ['templates:read'] } });
    const secret = result.data.secret;
    expect(secret).toMatch(/^slp_[A-Za-z0-9_-]{8}_[A-Za-z0-9_-]{43}$/);
    expect(repo.createApiKey).toHaveBeenCalledOnce();
    const saved = repo.createApiKey.mock.calls[0]?.[0].data;
    expect(saved.keyHash).toBe(createHash('sha256').update(secret).digest('hex'));
    expect(saved.keyHash).not.toBe(secret);
    expect(result.data).toMatchObject({ name: 'Example', scopes: ['templates:read'], projectId: 'project-1' });
  });

  it('hides key management when the runtime/environment gate is off and enforces the active-key cap', async () => {
    const off = fixture(false);
    await expect(off.useCase.list({ projectId: 'project-1', userId: 'owner-1' })).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    const capped = fixture(); capped.repo.countActiveApiKeys.mockResolvedValue(10);
    await expect(capped.useCase.create({ projectId: 'project-1', userId: 'owner-1', payload: { name: 'Example', scopes: ['templates:read'] } })).rejects.toMatchObject({ status: 400, code: 'API_KEY_LIMIT' });
  });
});
