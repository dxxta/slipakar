import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../lib/app-error.js';
import { logger } from '../lib/logger.js';
import { createErrorHandler, errorHandler } from './error-handler.js';

describe('errorHandler', () => {
  it('includes validation details when present', async () => {
    const app = express();
    app.get('/', () => { throw new AppError(400, 'VALIDATION', 'Validation failed', [{ path: ['name'] }]); });
    app.use(errorHandler);
    const response = await request(app).get('/');
    expect(response.body).toEqual({ error: { code: 'VALIDATION', message: 'Validation failed', details: [{ path: ['name'] }] } });
  });
  it('sends an AppError status and code', async () => {
    const app = express();
    app.get('/', () => { throw new AppError(409, 'CONFLICT', 'Already exists'); });
    app.use(errorHandler);
    const response = await request(app).get('/');
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: 'CONFLICT', message: 'Already exists' } });
  });

  it('hides unknown errors and logs them', async () => {
    const log = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const app = express();
    app.get('/', () => { throw new Error('private secret'); });
    app.use(errorHandler);
    const response = await request(app).get('/');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: 'INTERNAL', message: 'Internal server error' } });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('createErrorHandler', () => {
  it('reports unexpected errors with route context and still hides the message', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const capture = vi.fn();
    const app = express();
    app.get('/boom/:id', () => { throw new Error('private secret'); });
    app.use(createErrorHandler({ errorReporter: { capture } }));
    const response = await request(app).get('/boom/7');
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain('private secret');
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', route: '/boom/:id', status: 500 });
  });

  it('does not report expected AppErrors below 500', async () => {
    const capture = vi.fn();
    const app = express();
    app.get('/', () => { throw new AppError(404, 'NOT_FOUND', 'missing'); });
    app.use(createErrorHandler({ errorReporter: { capture } }));
    await request(app).get('/');
    expect(capture).not.toHaveBeenCalled();
  });

  it('still answers when the reporter throws', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const app = express();
    app.get('/', () => { throw new Error('x'); });
    app.use(createErrorHandler({ errorReporter: { capture: () => { throw new Error('reporter down'); } } }));
    const response = await request(app).get('/');
    expect(response.status).toBe(500);
  });
});
