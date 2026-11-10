import { describe, expect, it, vi } from 'vitest';
import { AdminSetupUseCase } from './admin-setup.js';
import type { AdminSetupRepositoryInterface } from '../../../domain/admin-setup/interface.js';
import type { CryptoServiceInterface } from '../../../services/crypto.js';
import type { IntegrationConfig } from '@prisma/client';

describe('AdminSetupUseCase', () => {
  const fakeCrypto: CryptoServiceInterface = {
    encrypt: vi.fn((str) => `enc:${str}`),
    decrypt: vi.fn((enc) => enc.replace(/^enc:/, '')),
  };

  it('getSetup returns all 3 integrations and complete=false when unconfigured', async () => {
    const mockRepo: AdminSetupRepositoryInterface = {
      findByKey: vi.fn(),
      listAll: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
      updateTestStatus: vi.fn(),
      deleteByKey: vi.fn(),
    };

    const useCase = new AdminSetupUseCase(mockRepo, fakeCrypto);
    const result = await useCase.getSetup();

    expect(result.complete).toBe(false);
    expect(result.integrations).toHaveLength(3);
    expect(result.integrations[0].key).toBe('uptime');
    expect(result.integrations[0].configured).toBe(false);
    expect(result.integrations[1].key).toBe('grafana');
    expect(result.integrations[1].configured).toBe(false);
    expect(result.integrations[2].key).toBe('mail');
    expect(result.integrations[2].configured).toBe(false);
  });

  it('getSetup reports mail as configured with source: env when envMailConfig is provided', async () => {
    const mockRepo: AdminSetupRepositoryInterface = {
      findByKey: vi.fn(),
      listAll: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
      updateTestStatus: vi.fn(),
      deleteByKey: vi.fn(),
    };

    const envMail = {
      host: 'smtp.env.com',
      port: 587,
      secure: false,
      user: 'u',
      pass: 'secret-pass-1234',
      from: 'noreply@env.com',
    };

    const useCase = new AdminSetupUseCase(mockRepo, fakeCrypto, envMail);
    const result = await useCase.getSetup();

    const mailItem = result.integrations.find((i) => i.key === 'mail');
    expect(mailItem?.configured).toBe(true);
    expect(mailItem?.source).toBe('env');
    expect(mailItem?.hasCredentials).toBe(true);
    expect(mailItem?.credentialHint).toBe('••••1234');
    expect(mailItem?.settings).toEqual({
      host: 'smtp.env.com',
      port: 587,
      secure: false,
      username: 'u',
      fromAddress: 'noreply@env.com',
    });
    // Ensure password is never present in settings
    expect((mailItem?.settings as Record<string, unknown>)?.pass).toBeUndefined();
    expect((mailItem?.settings as Record<string, unknown>)?.password).toBeUndefined();
    expect(mailItem?.lastStatus).toBe('ok');
  });

  it('uses environment monitoring setup when no database override exists and tests it', async () => {
    const mockRepo: AdminSetupRepositoryInterface = {
      findByKey: vi.fn().mockResolvedValue(null),
      listAll: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
      updateTestStatus: vi.fn(),
      deleteByKey: vi.fn(),
    };
    const envMonitoring = {
      grafana: { baseUrl: 'http://grafana:3000', apiToken: 'grafana-secret' },
      uptime: { baseUrl: 'http://uptime-kuma:3001', username: 'admin', password: 'uptime-secret' },
    };
    const fakeTester = vi.fn().mockResolvedValue({ ok: true });
    const useCase = new AdminSetupUseCase(mockRepo, fakeCrypto, undefined, undefined, fakeTester, envMonitoring);

    const setup = await useCase.getSetup();
    expect(setup.integrations.find((entry) => entry.key === 'grafana')).toMatchObject({ configured: true, source: 'env', baseUrl: envMonitoring.grafana.baseUrl, lastStatus: 'ok' });
    expect(setup.integrations.find((entry) => entry.key === 'uptime')).toMatchObject({ configured: true, source: 'env', baseUrl: envMonitoring.uptime.baseUrl, lastStatus: 'ok' });
    const result = await useCase.testIntegration('uptime');
    expect(fakeTester).toHaveBeenCalledWith('uptime', { baseUrl: envMonitoring.uptime.baseUrl, credentials: { username: 'admin', password: 'uptime-secret' } });
    expect(result.lastStatus).toBe('ok');
  });

  it('lets database credentials override environment monitoring setup', async () => {
    const uptimeRecord: IntegrationConfig = {
      id: 'uptime-1', key: 'uptime', baseUrl: 'https://uptime.example.test',
      credentialsEncrypted: 'enc:{"username":"db-admin","password":"db-password"}',
      lastStatus: 'failed', lastTestedAt: null, lastError: 'offline', updatedAt: new Date(), updatedBy: 'admin-1',
    };
    const mockRepo: AdminSetupRepositoryInterface = {
      findByKey: vi.fn(), listAll: vi.fn().mockResolvedValue([uptimeRecord]), upsert: vi.fn(), updateTestStatus: vi.fn(), deleteByKey: vi.fn(),
    };
    const useCase = new AdminSetupUseCase(mockRepo, fakeCrypto, undefined, undefined, undefined, {
      grafana: { baseUrl: 'http://grafana:3000', apiToken: 'env-token' },
      uptime: { baseUrl: 'http://uptime-kuma:3001', username: 'env-admin', password: 'env-password' },
    });
    const item = (await useCase.getSetup()).integrations.find((entry) => entry.key === 'uptime');
    expect(item).toMatchObject({ source: 'database', baseUrl: 'https://uptime.example.test', lastStatus: 'failed' });
  });

  it('marks an invalid environment URL as failed without exposing it as configured', async () => {
    const mockRepo: AdminSetupRepositoryInterface = {
      findByKey: vi.fn(), listAll: vi.fn().mockResolvedValue([]), upsert: vi.fn(), updateTestStatus: vi.fn(), deleteByKey: vi.fn(),
    };
    const useCase = new AdminSetupUseCase(mockRepo, fakeCrypto, undefined, undefined, undefined, {
      grafana: { baseUrl: 'file:///etc/passwd' },
    });
    const item = (await useCase.getSetup()).integrations.find((entry) => entry.key === 'grafana');
    expect(item).toMatchObject({ configured: false, source: 'env', lastStatus: 'failed' });
    expect(item?.lastError).toContain('Only HTTP and HTTPS');
  });

  it('updateIntegration encrypts credentials and produces credential hint', async () => {
    const storedRecord: IntegrationConfig = {
      id: 'cfg-1',
      key: 'uptime',
      baseUrl: 'http://uptime-kuma:3001',
      credentialsEncrypted: 'enc:{"apiKey":"12345678"}',
      lastStatus: null,
      lastTestedAt: null,
      lastError: null,
      updatedAt: new Date(),
      updatedBy: 'admin-1',
    };

    const mockRepo: AdminSetupRepositoryInterface = {
      findByKey: vi.fn().mockResolvedValue(null),
      listAll: vi.fn(),
      upsert: vi.fn().mockResolvedValue(storedRecord),
      updateTestStatus: vi.fn(),
      deleteByKey: vi.fn(),
    };

    const useCase = new AdminSetupUseCase(mockRepo, fakeCrypto);
    const result = await useCase.updateIntegration(
      'uptime',
      {
        baseUrl: 'http://uptime-kuma:3001',
        apiKey: '12345678',
      },
      'admin-1',
    );

    expect(result.key).toBe('uptime');
    expect(result.configured).toBe(true);
    expect(result.source).toBe('database');
    expect(result.hasCredentials).toBe(true);
    expect(result.credentialHint).toBe('••••5678');
    expect(fakeCrypto.encrypt).toHaveBeenCalledWith(
      JSON.stringify({ apiKey: '12345678' }),
    );
  });

  it('updateIntegration for mail triggers onMailConfigChanged callback', async () => {
    const storedMailRecord: IntegrationConfig = {
      id: 'cfg-m',
      key: 'mail',
      baseUrl: 'smtp.example.com',
      credentialsEncrypted: 'enc:{"port":587,"secure":false,"username":"u","password":"p","fromAddress":"noreply@example.com"}',
      lastStatus: null,
      lastTestedAt: null,
      lastError: null,
      updatedAt: new Date(),
      updatedBy: 'admin-1',
    };

    const mockRepo: AdminSetupRepositoryInterface = {
      findByKey: vi.fn().mockResolvedValue(null),
      listAll: vi.fn(),
      upsert: vi.fn().mockResolvedValue(storedMailRecord),
      updateTestStatus: vi.fn(),
      deleteByKey: vi.fn(),
    };

    const onMailChanged = vi.fn();
    const useCase = new AdminSetupUseCase(mockRepo, fakeCrypto, undefined, onMailChanged);

    const result = await useCase.updateIntegration(
      'mail',
      {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        fromAddress: 'noreply@example.com',
      },
      'admin-1',
    );

    expect(onMailChanged).toHaveBeenCalled();
    expect(result.key).toBe('mail');
    expect(result.settings).toEqual({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      username: 'u',
      fromAddress: 'noreply@example.com',
    });
    expect((result.settings as Record<string, unknown>).password).toBeUndefined();
  });

  it('testIntegration performs check and updates lastStatus ok', async () => {
    const record: IntegrationConfig = {
      id: 'cfg-1',
      key: 'grafana',
      baseUrl: 'http://grafana:3000',
      credentialsEncrypted: 'enc:{"apiToken":"token-12345678"}',
      lastStatus: null,
      lastTestedAt: null,
      lastError: null,
      updatedAt: new Date(),
      updatedBy: 'admin-1',
    };

    const testedRecord: IntegrationConfig = {
      ...record,
      lastStatus: 'ok',
      lastTestedAt: new Date(),
      lastError: null,
    };

    const mockRepo: AdminSetupRepositoryInterface = {
      findByKey: vi.fn().mockResolvedValue(record),
      listAll: vi.fn(),
      upsert: vi.fn(),
      updateTestStatus: vi.fn().mockResolvedValue(testedRecord),
      deleteByKey: vi.fn(),
    };

    const fakeTester = vi.fn().mockResolvedValue({ ok: true });
    const useCase = new AdminSetupUseCase(mockRepo, fakeCrypto, undefined, undefined, fakeTester);
    const result = await useCase.testIntegration('grafana');

    expect(result.lastStatus).toBe('ok');
    expect(mockRepo.updateTestStatus).toHaveBeenCalledWith(
      'grafana',
      expect.objectContaining({ lastStatus: 'ok', lastError: null }),
    );
  });
});
