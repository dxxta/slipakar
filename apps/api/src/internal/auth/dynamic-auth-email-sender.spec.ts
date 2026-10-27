import { describe, expect, it, vi } from 'vitest';
import { DynamicAuthEmailSender } from './dynamic-auth-email-sender.js';
import type { AdminSetupRepositoryInterface } from '../../domain/admin-setup/interface.js';
import type { CryptoServiceInterface } from '../../services/crypto.js';
import type { IntegrationConfig } from '@prisma/client';

describe('DynamicAuthEmailSender', () => {
  const fakeCrypto: CryptoServiceInterface = {
    encrypt: vi.fn((s) => `enc:${s}`),
    decrypt: vi.fn((s) => s.replace(/^enc:/, '')),
  };

  const envFallback = {
    host: 'smtp-env.example.com',
    port: 587,
    secure: false,
    user: 'env-user',
    pass: 'env-pass',
    from: 'env@example.com',
  };

  it('prefers database config over env fallback', async () => {
    const dbRecord: IntegrationConfig = {
      id: 'cfg-mail',
      key: 'mail',
      baseUrl: 'smtp-db.example.com',
      credentialsEncrypted: 'enc:{"port":465,"secure":true,"username":"db-user","password":"db-pass","fromAddress":"db@example.com"}',
      lastStatus: 'ok',
      lastTestedAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
      updatedBy: 'admin-1',
    };

    const mockRepo: AdminSetupRepositoryInterface = {
      findByKey: vi.fn().mockResolvedValue(dbRecord),
      listAll: vi.fn(),
      upsert: vi.fn(),
      updateTestStatus: vi.fn(),
      deleteByKey: vi.fn(),
    };

    const sender = new DynamicAuthEmailSender(mockRepo, fakeCrypto, envFallback);
    const resolved = await sender.resolveConfig();

    expect(resolved?.host).toBe('smtp-db.example.com');
    expect(resolved?.from).toBe('db@example.com');
    expect(resolved?.port).toBe(465);
    expect(resolved?.secure).toBe(true);
  });

  it('falls back to env when DB has no mail config', async () => {
    const mockRepo: AdminSetupRepositoryInterface = {
      findByKey: vi.fn().mockResolvedValue(null),
      listAll: vi.fn(),
      upsert: vi.fn(),
      updateTestStatus: vi.fn(),
      deleteByKey: vi.fn(),
    };

    const sender = new DynamicAuthEmailSender(mockRepo, fakeCrypto, envFallback);
    const resolved = await sender.resolveConfig();

    expect(resolved?.host).toBe('smtp-env.example.com');
    expect(resolved?.from).toBe('env@example.com');
  });

  it('caches config for 30s and invalidates on invalidate() call', async () => {
    const mockRepo: AdminSetupRepositoryInterface = {
      findByKey: vi.fn().mockResolvedValue(null),
      listAll: vi.fn(),
      upsert: vi.fn(),
      updateTestStatus: vi.fn(),
      deleteByKey: vi.fn(),
    };

    const sender = new DynamicAuthEmailSender(mockRepo, fakeCrypto, envFallback);
    await sender.resolveConfig();
    await sender.resolveConfig();
    expect(mockRepo.findByKey).toHaveBeenCalledTimes(1);

    sender.invalidate();
    await sender.resolveConfig();
    expect(mockRepo.findByKey).toHaveBeenCalledTimes(2);
  });
});
