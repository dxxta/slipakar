import { describe, expect, it } from 'vitest';
import {
  updateUptimeIntegrationDto,
  updateGrafanaIntegrationDto,
  updateMailIntegrationDto,
  integrationItemViewDto,
  adminSetupViewDto,
} from './dto.js';

describe('admin-setup dto', () => {
  it('validates uptime integration input correctly', () => {
    expect(() =>
      updateUptimeIntegrationDto.parse({
        baseUrl: 'http://uptime-kuma:3001',
        apiKey: 'secret-key-12345678',
      }),
    ).not.toThrow();

    expect(() =>
      updateUptimeIntegrationDto.parse({
        baseUrl: 'http://uptime-kuma:3001',
        username: 'admin',
        password: 'password123',
      }),
    ).not.toThrow();

    // Rejects username without password
    expect(() =>
      updateUptimeIntegrationDto.parse({
        baseUrl: 'http://uptime-kuma:3001',
        username: 'admin',
      }),
    ).toThrow();

    // Rejects apiKey together with username
    expect(() =>
      updateUptimeIntegrationDto.parse({
        baseUrl: 'http://uptime-kuma:3001',
        apiKey: 'key',
        username: 'admin',
        password: 'password123',
      }),
    ).toThrow();

    // Rejects metadata URL
    expect(() =>
      updateUptimeIntegrationDto.parse({
        baseUrl: 'http://169.254.169.254:3001',
      }),
    ).toThrow();
  });

  it('validates grafana integration input correctly', () => {
    expect(() =>
      updateGrafanaIntegrationDto.parse({
        baseUrl: 'http://grafana:3000',
        apiToken: 'glsa_mytoken1234',
      }),
    ).not.toThrow();

    // Rejects invalid protocol
    expect(() =>
      updateGrafanaIntegrationDto.parse({
        baseUrl: 'ftp://grafana:3000',
      }),
    ).toThrow();
  });

  it('validates mail integration input correctly', () => {
    expect(() =>
      updateMailIntegrationDto.parse({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        username: 'smtp-user',
        password: 'smtp-password',
        fromAddress: 'noreply@example.com',
      }),
    ).not.toThrow();

    // Rejects username without password
    expect(() =>
      updateMailIntegrationDto.parse({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        username: 'smtp-user',
        fromAddress: 'noreply@example.com',
      }),
    ).toThrow();
  });

  it('validates views correctly', () => {
    const item = integrationItemViewDto.parse({
      key: 'uptime',
      label: 'Uptime Kuma',
      configured: true,
      source: 'database',
      baseUrl: 'http://uptime-kuma:3001',
      hasCredentials: true,
      credentialHint: '••••5678',
      settings: null,
      lastStatus: 'ok',
      lastTestedAt: new Date().toISOString(),
      lastError: null,
    });
    expect(item.key).toBe('uptime');
    expect(item.settings).toBeNull();

    const mailItem = integrationItemViewDto.parse({
      key: 'mail',
      label: 'Platform Mailer',
      configured: true,
      source: 'database',
      baseUrl: 'smtp.example.com',
      hasCredentials: true,
      credentialHint: '••••1234',
      settings: {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        username: 'user@example.com',
        fromAddress: 'noreply@example.com',
      },
      lastStatus: 'ok',
      lastTestedAt: new Date().toISOString(),
      lastError: null,
    });
    expect(mailItem.settings?.host).toBe('smtp.example.com');
    // Ensure secrets like password are not in settings type/schema
    expect((mailItem.settings as Record<string, unknown>).password).toBeUndefined();

    const setup = adminSetupViewDto.parse({
      complete: true,
      integrations: [item, mailItem],
    });
    expect(setup.complete).toBe(true);
  });
});
