import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createLoginActivityRouter } from './login-activity.js';
import type { LoginActivityUseCaseInterface } from '../../../../domain/login-activity/interface.js';

describe('LoginActivity HTTP router', () => {
  const mockUseCase: LoginActivityUseCaseInterface = {
    getUserActivity: vi.fn().mockResolvedValue({
      data: [{ id: 'evt-1', ip: '8.8.8.8' }],
      metadata: { page: 1, limit: 20, total: 1 },
    }),
    getAdminActivity: vi.fn().mockResolvedValue({
      data: [{ id: 'evt-2', userId: 'user-2', ip: '1.1.1.1', userEmail: '*****@example.com' }],
      metadata: { page: 1, limit: 20, total: 1 },
    }),
    recordLogin: vi.fn(),
    purgeExpired: vi.fn(),
  };

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.userId = 'user-123';
    next();
  });
  app.use(
    createLoginActivityRouter({
      userGuards: [],
      adminGuards: [],
      useCase: mockUseCase,
    }),
  );

  it('GET /me/login-activity returns paginated user events', async () => {
    const res = await request(app).get('/me/login-activity');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'Login activity retrieved',
      data: [{ id: 'evt-1', ip: '8.8.8.8' }],
      metadata: { page: 1, limit: 20, total: 1 },
      success: true,
    });
  });

  it('GET /admin/login-activity returns paginated admin events', async () => {
    const res = await request(app).get('/admin/login-activity');
    expect(mockUseCase.getAdminActivity).toHaveBeenCalledWith({}, 'user-123');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'All login activity retrieved',
      data: [{ id: 'evt-2', userId: 'user-2', ip: '1.1.1.1', userEmail: '*****@example.com' }],
      metadata: { page: 1, limit: 20, total: 1 },
      success: true,
    });
  });
});
