import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { NotificationsUseCaseInterface } from '../../../../domain/notifications/interface.js';
import { errorHandler } from '../../../../middleware/error-handler.js';
import { createNotificationsRouter } from './notifications.js';

describe('Notifications HTTP router unit tests', () => {
  it('GET /projects/:projectId/notifications returns 200 with envelope', async () => {
    const useCase: NotificationsUseCaseInterface = {
      handleNotify: vi.fn(),
      listNotificationsUseCase: vi.fn().mockResolvedValue({
        message: 'Notifications retrieved successfully',
        data: [],
        metadata: { page: 1, limit: 20, total: 0 },
        success: true,
      }),
    };

    const app = express();
    app.use(
      createNotificationsRouter({
        guards: [
          (_req, res, next) => {
            res.locals.userId = 'user-1';
            next();
          },
        ],
        useCase,
      }),
    );
    app.use(errorHandler);

    const res = await request(app).get('/projects/p-1/notifications?page=1&limit=20');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'Notifications retrieved successfully',
      data: [],
      metadata: { page: 1, limit: 20, total: 0 },
      success: true,
    });
    expect(useCase.listNotificationsUseCase).toHaveBeenCalledWith({
      projectId: 'p-1',
      query: { page: '1', limit: '20' },
      auditUserId: 'user-1',
    });
  });
});
