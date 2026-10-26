import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validate } from './validate.js';

describe('validate', () => {
  it('replaces the body with parsed data', async () => {
    const app = express();
    app.use(express.json());
    app.post('/', validate(z.object({ count: z.coerce.number() }), 'body'), (req, res) => { res.json(req.body); });
    const response = await request(app).post('/').send({ count: '2' });
    expect(response.body).toEqual({ count: 2 });
  });

  it('responds 400 with validation details', async () => {
    const app = express();
    app.use(express.json());
    app.post('/', validate(z.object({ count: z.number() }), 'body'), (_req, res) => { res.sendStatus(204); });
    const response = await request(app).post('/').send({ count: 'bad' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION');
    expect(response.body.error.details).toBeDefined();
  });
});
