import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { ApiKeysRepositoryInterface } from '../../../domain/apikeys/interface.js';
import { buildEmbedTokenService } from './embed-token-service.js';

const sourceKey = { id: 'abcdefgh', prefix: 'abcdefgh', projectId: 'project-1', keyHash: '0'.repeat(64), scopes: ['templates:read', 'embed:create'], revokedAt: null, expiresAt: null, project: { owner: { id: 'user-1', email: 'user@example.test', role: 'user', disabledAt: null, disabledReason: null } } };
function setup(active = true) {
  let launchRecord: string | null = null;
  const redis = {
    set: vi.fn(async (key: string, value: string, _mode: string, _ttl: number, _nx: string) => { if (key.startsWith('embed:launch:')) launchRecord = value; return 'OK'; }),
    eval: vi.fn(async () => { const value = launchRecord; launchRecord = null; return value; }),
  };
  const keyRepository = { findByPrefix: vi.fn().mockResolvedValue(sourceKey) };
  const rateLimiter = { tryAcquire: vi.fn().mockResolvedValue({ allowed: true }) };
  const useCase = buildEmbedTokenService({ redis: redis as never, keyRepository: keyRepository as unknown as ApiKeysRepositoryInterface, rateLimiter: rateLimiter as never, isActive: async () => active, allowedOrigins: ['https://host.example'], publicBaseUrl: 'https://slipakar.example/path' });
  return { useCase, redis, keyRepository, rateLimiter };
}

describe('embed token service', () => {
  it('stores only a hashed launch token and binds project, allowed scopes, origin and theme', async () => {
    const { useCase, redis } = setup();
    const result = await useCase.mint({ projectId: 'project-1', keyId: 'abcdefgh', keyScopes: sourceKey.scopes, payload: { parentOrigin: 'https://host.example', scopes: ['templates:read'], theme: { mode: 'dark', accent: '#102030' } } });
    expect(result.data.url).toContain('https://slipakar.example/embed?token=slpl_');
    expect(result.data.expiresAt).toBeTruthy();
    expect(redis.set).toHaveBeenCalledOnce();
    const storedKey = redis.set.mock.calls[0]?.[0] as string;
    expect(storedKey).toBe(`embed:launch:${createHash('sha256').update(result.data.token).digest('hex')}`);
    expect(redis.set.mock.calls[0]?.[1]).not.toContain(result.data.token);
    expect(redis.set.mock.calls[0]?.[2]).toBe('EX');
    expect(redis.set.mock.calls[0]?.[3]).toBe(300);
  });

  it('exchanges a launch token once into a project-bound 60-minute session', async () => {
    const { useCase, redis, keyRepository, rateLimiter } = setup();
    const minted = await useCase.mint({ projectId: 'project-1', keyId: 'abcdefgh', keyScopes: sourceKey.scopes, payload: { parentOrigin: 'https://host.example', scopes: ['templates:read'] } });
    const result = await useCase.exchange({ payload: { token: minted.data.token }, ip: '203.0.113.5' });
    expect(result.data).toMatchObject({ projectId: 'project-1', scopes: ['templates:read'], parentOrigin: 'https://host.example' });
    expect(result.data.token).toMatch(/^slpe_[A-Za-z0-9_-]{43}$/);
    expect(redis.eval).toHaveBeenCalledOnce();
    expect(keyRepository.findByPrefix).toHaveBeenCalledWith('abcdefgh');
    expect(rateLimiter.tryAcquire).toHaveBeenCalledWith('embed-exchange:203.0.113.5', 20);
    const sessionKey = redis.set.mock.calls[1]?.[0] as string;
    expect(sessionKey).toBe(`embed:session:${createHash('sha256').update(result.data.token).digest('hex')}`);
    expect(redis.set.mock.calls[1]?.[3]).toBe(3600);
    expect(redis.set.mock.calls[1]?.[1]).not.toContain(result.data.token);
    await expect(useCase.exchange({ payload: { token: minted.data.token }, ip: '203.0.113.5' })).rejects.toMatchObject({ status: 404 });
  });

  it('returns 404 when embedding is inactive or when a requested scope is not owned by the API key', async () => {
    const off = setup(false);
    await expect(off.useCase.mint({ projectId: 'project-1', keyId: 'abcdefgh', keyScopes: sourceKey.scopes, payload: { parentOrigin: 'https://host.example' } })).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    await expect(off.useCase.exchange({ payload: { token: `slpl_${'x'.repeat(43)}` }, ip: '127.0.0.1' })).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    const on = setup();
    await expect(on.useCase.mint({ projectId: 'project-1', keyId: 'abcdefgh', keyScopes: ['embed:create'], payload: { parentOrigin: 'https://host.example', scopes: ['templates:read'] } })).rejects.toMatchObject({ status: 400 });
  });
});
