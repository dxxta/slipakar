import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../middleware/error-handler.js';
import { userId } from './user-id.js';

describe('userId', () => {
  it('returns the ID from response locals', async () => {
    const app = express();
    app.get('/', (_req, res) => { res.locals.userId = 'user-1'; res.json({ userId: userId(res) }); });
    expect((await request(app).get('/')).body).toEqual({ userId: 'user-1' });
  });

  it('rejects a missing ID with UNAUTHENTICATED', async () => {
    const app = express();
    app.get('/', (_req, res) => { res.json({ userId: userId(res) }); });
    app.use(errorHandler);
    const response = await request(app).get('/');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});
