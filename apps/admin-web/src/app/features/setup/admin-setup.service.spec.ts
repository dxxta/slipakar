import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminSetupService, type AdminSetupView } from './admin-setup.service';

const apiAccessView = { environmentEnabled: true, allowedOrigins: ['https://app.example.test'], runtimeEnabled: false, embed: { environmentEnabled: false, allowedOrigins: [], runtimeEnabled: false, apiAccessActive: false } };

const setupView: AdminSetupView = {
  complete: false,
  integrations: [
    { key: 'uptime', label: 'Uptime Kuma', configured: false, source: null, baseUrl: null, hasCredentials: false, credentialHint: null, settings: null, lastStatus: null, lastTestedAt: null, lastError: null },
    { key: 'grafana', label: 'Grafana', configured: false, source: null, baseUrl: null, hasCredentials: false, credentialHint: null, settings: null, lastStatus: null, lastTestedAt: null, lastError: null },
    { key: 'mail', label: 'Platform Mailer', configured: true, source: 'env', baseUrl: 'smtp.example.test', hasCredentials: true, credentialHint: '••••word', settings: { host: 'smtp.example.test', port: 587, secure: false, username: 'service', fromAddress: 'no-reply@example.test' }, lastStatus: 'ok', lastTestedAt: null, lastError: null },
  ],
};

describe('AdminSetupService', () => {
  let service: AdminSetupService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), AdminSetupService] });
    service = TestBed.inject(AdminSetupService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the real setup envelope and keeps source metadata', async () => {
    const result = service.load();
    http.expectOne('/admin/setup').flush({ message: 'ok', data: setupView, success: true });
    http.expectOne('/admin/api-access').flush({ message: 'ok', data: apiAccessView, success: true });
    await expect(result).resolves.toEqual(setupView);
    expect(service.view()).toEqual(setupView);
    expect(service.apiAccess()).toEqual(apiAccessView);
  });

  it('updates the embedding runtime flag and refreshes the environment status', async () => {
    const result = service.setEmbedAccess(true);
    http.expectOne({ method: 'PUT', url: '/admin/config/embed_enabled' }).flush({ message: 'ok', data: { key: 'embed_enabled', value: true }, success: true });
    http.expectOne('/admin/api-access').flush({ message: 'ok', data: { ...apiAccessView, embed: { environmentEnabled: true, allowedOrigins: ['https://host.example'], runtimeEnabled: true, apiAccessActive: true } }, success: true });
    await expect(result).resolves.toMatchObject({ embed: { runtimeEnabled: true, apiAccessActive: true } });
  });

  it('updates the runtime flag then refreshes effective API access settings', async () => {
    const result = service.setApiAccess(true);
    http.expectOne({ method: 'PUT', url: '/admin/config/api_access_enabled' }).flush({ message: 'ok', data: { key: 'api_access_enabled', value: true }, success: true });
    http.expectOne('/admin/api-access').flush({ message: 'ok', data: { ...apiAccessView, runtimeEnabled: true }, success: true });
    await expect(result).resolves.toMatchObject({ runtimeEnabled: true });
  });

  it('saves a mail configuration without sending an empty write-only password', async () => {
    const result = service.save('mail', { host: 'smtp.example.test', port: 587, secure: false, username: 'robot', password: '', fromAddress: 'noreply@example.test' });
    const request = http.expectOne('/admin/setup/mail');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ host: 'smtp.example.test', port: 587, secure: false, username: 'robot', fromAddress: 'noreply@example.test' });
    request.flush({ message: 'ok', data: { ...setupView.integrations[2], source: 'database' }, success: true });
    await result;
  });

  it('tests and clears an integration using the documented endpoints', async () => {
    const testResult = service.test('grafana');
    http.expectOne({ method: 'POST', url: '/admin/setup/grafana/test' }).flush({ message: 'ok', data: setupView.integrations[1], success: true });
    await testResult;
    const clearResult = service.clear('grafana');
    http.expectOne({ method: 'DELETE', url: '/admin/setup/grafana' }).flush({ message: 'ok', data: setupView.integrations[1], success: true });
    await clearResult;
  });
});
