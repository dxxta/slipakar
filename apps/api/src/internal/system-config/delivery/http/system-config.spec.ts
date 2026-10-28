import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { SystemConfigUseCaseInterface } from '../../../../domain/system-config/interface.js';
import { errorHandler } from '../../../../middleware/error-handler.js';
import { createSystemConfigRouter } from './system-config.js';

describe('system-config delivery router', () => {
  it('GET /admin/config returns envelope and 200', async () => {
    const useCase: SystemConfigUseCaseInterface = {
      getSystemConfigUseCase: vi.fn().mockResolvedValue({
        message: 'System config retrieved successfully',
        data: [{ key: 'scalar_docs', value: true }],
        success: true,
      }),
      updateSystemConfigUseCase: vi.fn(),
    };

    const app = express();
    app.use(express.json());
    app.use(
      createSystemConfigRouter({
        guards: [
          (_req, res, next) => {
            res.locals.userId = 'admin-1';
            next();
          },
        ],
        useCase,
      }),
    );
    app.use(errorHandler);

    const res = await request(app).get('/admin/config');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'System config retrieved successfully',
      data: [{ key: 'scalar_docs', value: true }],
      success: true,
    });
    expect(useCase.getSystemConfigUseCase).toHaveBeenCalledWith({ auditUserId: 'admin-1' });
  });

  it('PUT /admin/config/:key returns envelope and 200', async () => {
    const useCase: SystemConfigUseCaseInterface = {
      getSystemConfigUseCase: vi.fn(),
      updateSystemConfigUseCase: vi.fn().mockResolvedValue({
        message: 'System config updated successfully',
        data: { key: 'scalar_docs', value: false },
        success: true,
      }),
    };

    const app = express();
    app.use(express.json());
    app.use(
      createSystemConfigRouter({
        guards: [
          (_req, res, next) => {
            res.locals.userId = 'admin-1';
            next();
          },
        ],
        useCase,
      }),
    );
    app.use(errorHandler);

    const res = await request(app).put('/admin/config/scalar_docs').send({ value: false });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'System config updated successfully',
      data: { key: 'scalar_docs', value: false },
      success: true,
    });
    expect(useCase.updateSystemConfigUseCase).toHaveBeenCalledWith({
      key: 'scalar_docs',
      payload: { value: false },
      auditUserId: 'admin-1',
    });
  });
});
