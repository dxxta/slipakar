import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { AuditUseCaseInterface } from '../../../../domain/audit/interface.js';
import { errorHandler } from '../../../../middleware/error-handler.js';
import { createAuditRouter } from './audit.js';

describe('audit HTTP delivery', () => {
  it('GET /projects/:projectId/activity routes query and params to usecase', async () => {
    const useCase: AuditUseCaseInterface = {
      listProjectActivityUseCase: vi.fn().mockResolvedValue({
        message: 'Project activity retrieved successfully',
        data: [],
        metadata: { page: 1, limit: 20, total: 0 },
        success: true,
      }),
    };

    const guard: RequestHandler = (_req, res, next) => {
      res.locals.userId = 'user-1';
      next();
    };

    const app = express();
    app.use(createAuditRouter({ guards: [guard], useCase }));
    app.use(errorHandler);

    const res = await request(app).get('/projects/p-1/activity?page=2&limit=10');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'Project activity retrieved successfully',
      data: [],
      metadata: { page: 1, limit: 20, total: 0 },
      success: true,
    });
    expect(useCase.listProjectActivityUseCase).toHaveBeenCalledWith({
      projectId: 'p-1',
      query: { page: '2', limit: '10' },
      auditUserId: 'user-1',
    });
  });
});
