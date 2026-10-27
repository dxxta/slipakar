import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../middleware/error-handler.js';
import { createRequireAuth } from './require-auth.js';

describe('createRequireAuth', () => {
  it('rejects a missing session', async () => {
    const app = express();
    app.get('/', createRequireAuth(async () => null), (_req, res) => { res.sendStatus(204); });
    app.use(errorHandler);
    const response = await request(app).get('/');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
  });

  it('sets the authenticated user on the request', async () => {
    const user = { id: 'user-1', email: 'person@example.com', role: 'user' };
    const app = express();
    app.get('/', createRequireAuth(async () => ({ user })), (req, res) => { res.json(req.user); });
    app.use(errorHandler);
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(user);
  });

  it('sets the authenticated user ID on response locals', async () => {
    const user = { id: 'user-2', email: 'second@example.com', role: 'user' };
    const app = express();
    app.get('/', createRequireAuth(async () => ({ user })), (_req, res) => { res.json({ userId: res.locals.userId }); });
    expect((await request(app).get('/')).body).toEqual({ userId: 'user-2' });
  });

  it('rejects with 403 ACCOUNT_DISABLED when user is disabled', async () => {
    const user = { id: 'user-3', email: 'disabled@example.com', role: 'user', disabledAt: new Date() };
    const app = express();
    app.get('/', createRequireAuth(async () => ({ user })), (_req, res) => { res.sendStatus(204); });
    app.use(errorHandler);

    const response = await request(app).get('/');
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: 'ACCOUNT_DISABLED',
        message: 'Account is disabled',
      },
    });
  });
});
