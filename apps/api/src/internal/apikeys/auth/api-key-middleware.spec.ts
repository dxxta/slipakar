import { createHash } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../middleware/error-handler.js';
import { createApiKeyMiddleware } from './api-key-middleware.js';

const token = `slp_abcdefgh_${'a'.repeat(43)}`;
const owner = { id: 'owner-1', email: 'owner@example.test', role: 'user', disabledAt: null, disabledReason: null };
function setup(options: { active?: boolean; embedActive?: boolean; projectId?: string; revokedAt?: Date | null; expiresAt?: Date | null; scopes?: string[]; disabledAt?: Date | null } = {}) {
  const record = { id: 'abcdefgh', prefix: 'abcdefgh', projectId: options.projectId ?? 'project-1', keyHash: createHash('sha256').update(token).digest('hex'), scopes: options.scopes ?? ['templates:read'], revokedAt: options.revokedAt ?? null, expiresAt: options.expiresAt ?? null, project: { owner: { ...owner, disabledAt: options.disabledAt ?? null } } };
  const repository = { findByPrefix: vi.fn().mockResolvedValue(record), touchApiKey: vi.fn().mockResolvedValue(undefined) };
  const rateLimiter = { tryAcquire: vi.fn().mockResolvedValue({ allowed: true }) };
  const embedToken = `slpe_${'b'.repeat(43)}`;
  const embedRecord = { projectId: 'project-1', scopes: ['templates:read'], parentOrigin: 'https://host.example', theme: null, keyId: 'abcdefgh', createdAt: Date.now(), expiresAt: new Date(Date.now() + 60_000).toISOString() };
  const embedRedis = { get: vi.fn().mockResolvedValue(JSON.stringify(embedRecord)) };
  const app = express();
  app.use(createApiKeyMiddleware({ repository: repository as never, isActive: async () => options.active ?? true, isEmbedActive: async () => options.embedActive ?? true, rateLimiter: rateLimiter as never, allowedOrigins: ['https://client.example'], embedRedis: embedRedis as never }));
  app.get('/projects/:projectId/templates', (req, res) => res.json({ ownerId: req.user?.id, apiKey: req.apiKey?.id }));
  app.get('/projects/:projectId/smtp', (_req, res) => res.json({ ok: true }));
  app.get('/admin/users', (_req, res) => res.json({ ok: true }));
  app.get('/me/preferences', (_req, res) => res.json({ ok: true }));
  app.delete('/projects/:projectId/api-keys/:id', (_req, res) => res.json({ ok: true }));
  app.patch('/projects/:projectId/smtp/:id', (_req, res) => res.json({ ok: true }));
  app.post('/projects/:projectId/attachments', (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return { app, repository, rateLimiter, embedRedis, embedToken, embedRecord };
}

describe('API key middleware', () => {
  it('authenticates a scoped key and binds it to its project owner', async () => {
    const { app, repository } = setup();
    const response = await request(app).get('/projects/project-1/templates').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ownerId: 'owner-1', apiKey: 'abcdefgh' });
    expect(repository.touchApiKey).toHaveBeenCalledOnce();
  });

  it('denies routes without opt-in scopes, cross-project access, inactive keys, revoked keys, and expired keys', async () => {
    const denied = await request(setup().app).get('/admin/users').set('Authorization', `Bearer ${token}`);
    expect(denied.status).toBe(403);
    const otherProject = await request(setup().app).get('/projects/other/templates').set('Authorization', `Bearer ${token}`);
    expect(otherProject.status).toBe(403);
    expect((await request(setup({ active: false }).app).get('/projects/project-1/templates').set('Authorization', `Bearer ${token}`)).status).toBe(401);
    expect((await request(setup({ revokedAt: new Date() }).app).get('/projects/project-1/templates').set('Authorization', `Bearer ${token}`)).status).toBe(401);
    expect((await request(setup({ expiresAt: new Date(Date.now() - 1000) }).app).get('/projects/project-1/templates').set('Authorization', `Bearer ${token}`)).status).toBe(401);
    expect((await request(setup({ disabledAt: new Date() }).app).get('/projects/project-1/templates').set('Authorization', `Bearer ${token}`)).body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('restricts embed sessions to the selected project and read/write scopes, and rechecks the source key', async () => {
    const { app, repository, embedToken } = setup();
    const allowed = await request(app).get('/projects/project-1/templates').set('Authorization', `Bearer ${embedToken}`);
    expect(allowed.status).toBe(200);
    expect(repository.findByPrefix).toHaveBeenCalledWith('abcdefgh');
    const deniedPaths = ['/admin/users', '/me/preferences', '/projects/project-1/api-keys/key-1'];
    for (const path of deniedPaths) expect((await request(app).get(path).set('Authorization', `Bearer ${embedToken}`)).status).toBe(403);
    expect((await request(app).patch('/projects/project-1/smtp/conn-1').set('Authorization', `Bearer ${embedToken}`)).status).toBe(403);
    expect((await request(app).post('/projects/project-1/attachments').set('Authorization', `Bearer ${embedToken}`)).status).toBe(403);
    expect((await request(app).get('/projects/project-2/templates').set('Authorization', `Bearer ${embedToken}`)).status).toBe(403);
    const revoked = setup({ revokedAt: new Date() });
    expect((await request(revoked.app).get('/projects/project-1/templates').set('Authorization', `Bearer ${revoked.embedToken}`)).status).toBe(401);
    const disabledOwner = setup({ disabledAt: new Date() });
    expect((await request(disabledOwner.app).get('/projects/project-1/templates').set('Authorization', `Bearer ${disabledOwner.embedToken}`)).status).toBe(401);
    expect((await request(setup({ embedActive: false }).app).get('/projects/project-1/templates').set('Authorization', `Bearer ${embedToken}`)).status).toBe(401);
  });

  it('allows only configured CORS origins and does not enable credentialed CORS', async () => {
    const app = setup().app;
    const allowed = await request(app).options('/projects/project-1/templates').set('Origin', 'https://client.example').set('Access-Control-Request-Method', 'GET');
    expect(allowed.status).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe('https://client.example');
    expect(allowed.headers['access-control-allow-credentials']).toBeUndefined();
    const denied = await request(app).get('/projects/project-1/templates').set('Origin', 'https://other.example').set('Authorization', `Bearer ${token}`);
    expect(denied.status).toBe(403);
  });
});
