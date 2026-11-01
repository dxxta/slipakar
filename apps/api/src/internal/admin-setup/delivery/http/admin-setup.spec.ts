import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAdminSetupRouter } from './admin-setup.js';
import type { AdminSetupUseCaseInterface } from '../../../../domain/admin-setup/interface.js';

describe('AdminSetup HTTP routes', () => {
  const mockUseCase: AdminSetupUseCaseInterface = {
    getSetup: vi.fn().mockResolvedValue({
      complete: false,
      integrations: [
        {
          key: 'uptime',
          label: 'Uptime Kuma',
          configured: false,
          source: null,
          baseUrl: null,
          hasCredentials: false,
          credentialHint: null,
          lastStatus: null,
          lastTestedAt: null,
          lastError: null,
        },
      ],
    }),
    updateIntegration: vi.fn().mockResolvedValue({
      key: 'uptime',
      label: 'Uptime Kuma',
      configured: true,
      source: 'database',
      baseUrl: 'http://uptime-kuma:3001',
      hasCredentials: true,
      credentialHint: '••••5678',
      lastStatus: null,
      lastTestedAt: null,
      lastError: null,
    }),
    deleteIntegration: vi.fn().mockResolvedValue({
      key: 'uptime',
      label: 'Uptime Kuma',
      configured: false,
      source: null,
      baseUrl: null,
      hasCredentials: false,
      credentialHint: null,
      lastStatus: null,
      lastTestedAt: null,
      lastError: null,
    }),
    testIntegration: vi.fn().mockResolvedValue({
      key: 'uptime',
      label: 'Uptime Kuma',
      configured: true,
      source: 'database',
      baseUrl: 'http://uptime-kuma:3001',
      hasCredentials: true,
      credentialHint: '••••5678',
      lastStatus: 'ok',
      lastTestedAt: new Date().toISOString(),
      lastError: null,
    }),
    testSendMail: vi.fn().mockResolvedValue({ ok: true }),
  };

  const app = express();
  app.use(express.json());
  app.use(createAdminSetupRouter({ guards: [], useCase: mockUseCase }));

  it('GET /admin/setup returns 200 with envelope', async () => {
    const res = await request(app).get('/admin/setup');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Admin setup retrieved');
    expect(res.body.data.complete).toBe(false);
  });

  it('PUT /admin/setup/:key returns 200 with envelope', async () => {
    const res = await request(app)
      .put('/admin/setup/uptime')
      .send({ baseUrl: 'http://uptime-kuma:3001', apiKey: '12345678' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Integration configured');
    expect(res.body.data.credentialHint).toBe('••••5678');
  });

  it('DELETE /admin/setup/:key returns 200 with envelope', async () => {
    const res = await request(app).delete('/admin/setup/uptime');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Integration cleared');
    expect(res.body.data.configured).toBe(false);
  });

  it('POST /admin/setup/:key/test returns 200 with envelope', async () => {
    const res = await request(app).post('/admin/setup/uptime/test');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Integration test executed');
    expect(res.body.data.lastStatus).toBe('ok');
  });

  it('POST /admin/setup/mail/test-send sends test email to given recipient', async () => {
    const res = await request(app)
      .post('/admin/setup/mail/test-send')
      .send({ to: 'recipient@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ok).toBe(true);
    expect(mockUseCase.testSendMail).toHaveBeenCalledWith('recipient@example.com', expect.any(String));
  });
});
