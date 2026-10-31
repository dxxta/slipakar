import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../../middleware/error-handler.js';
import type { AdminUsersUseCaseInterface } from '../../../../domain/admin-users/interface.js';
import { createAdminUsersRouter } from './admin-users.js';

describe('Admin Users Router', () => {
  const mockUseCase: AdminUsersUseCaseInterface = {
    listUsers: vi.fn(),
    getUser: vi.fn(),
    updateUser: vi.fn(),
    disableUser: vi.fn(),
    enableUser: vi.fn(),
  };

  const app = express();
  app.use(express.json());
  app.use(
    createAdminUsersRouter({
      guards: [
        (_req, res, next) => {
          res.locals.userId = 'admin-user-1';
          next();
        },
      ],
      useCase: mockUseCase,
    }),
  );
  app.use(errorHandler);

  it('GET /admin/users delegates to useCase.listUsers', async () => {
    vi.mocked(mockUseCase.listUsers).mockResolvedValueOnce({
      message: 'Users retrieved successfully',
      data: [],
      metadata: { page: 1, limit: 20, total: 0 },
      success: true,
    });

    const response = await request(app).get('/admin/users?page=1&limit=20');
    expect(response.status).toBe(200);
    expect(mockUseCase.listUsers).toHaveBeenCalledWith({
      query: { page: '1', limit: '20' },
      auditUserId: 'admin-user-1',
    });
  });

  it('GET /admin/users/:id delegates to useCase.getUser', async () => {
    vi.mocked(mockUseCase.getUser).mockResolvedValueOnce({
      message: 'User retrieved successfully',
      data: {
        id: 'usr-1',
        email: 'alice@example.com',
        name: 'Alice',
        image: null,
        role: 'user',
        emailVerified: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        disabledAt: null,
        projectCount: 0,
      },
      success: true,
    });

    const response = await request(app).get('/admin/users/usr-1');
    expect(response.status).toBe(200);
    expect(mockUseCase.getUser).toHaveBeenCalledWith({
      id: 'usr-1',
      auditUserId: 'admin-user-1',
    });
  });

  it('PATCH /admin/users/:id delegates to useCase.updateUser', async () => {
    vi.mocked(mockUseCase.updateUser).mockResolvedValueOnce({
      message: 'User updated successfully',
      data: {
        id: 'usr-1',
        email: 'alice@example.com',
        name: 'Alice Updated',
        image: null,
        role: 'user',
        emailVerified: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        disabledAt: null,
        projectCount: 0,
      },
      success: true,
    });

    const response = await request(app).patch('/admin/users/usr-1').send({ name: 'Alice Updated' });
    expect(response.status).toBe(200);
    expect(mockUseCase.updateUser).toHaveBeenCalledWith({
      id: 'usr-1',
      payload: { name: 'Alice Updated' },
      auditUserId: 'admin-user-1',
    });
  });

  it('POST /admin/users/:id/disable delegates to useCase.disableUser', async () => {
    vi.mocked(mockUseCase.disableUser).mockResolvedValueOnce({
      message: 'User disabled successfully',
      data: {
        id: 'usr-1',
        email: 'alice@example.com',
        name: 'Alice',
        image: null,
        role: 'user',
        emailVerified: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        disabledAt: '2026-01-02T00:00:00.000Z',
        projectCount: 0,
      },
      success: true,
    });

    const response = await request(app).post('/admin/users/usr-1/disable').send({ reason: 'testing' });
    expect(response.status).toBe(200);
    expect(mockUseCase.disableUser).toHaveBeenCalledWith({
      id: 'usr-1',
      payload: { reason: 'testing' },
      auditUserId: 'admin-user-1',
    });
  });

  it('POST /admin/users/:id/enable delegates to useCase.enableUser', async () => {
    vi.mocked(mockUseCase.enableUser).mockResolvedValueOnce({
      message: 'User enabled successfully',
      data: {
        id: 'usr-1',
        email: 'alice@example.com',
        name: 'Alice',
        image: null,
        role: 'user',
        emailVerified: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        disabledAt: null,
        projectCount: 0,
      },
      success: true,
    });

    const response = await request(app).post('/admin/users/usr-1/enable').send({});
    expect(response.status).toBe(200);
    expect(mockUseCase.enableUser).toHaveBeenCalledWith({
      id: 'usr-1',
      auditUserId: 'admin-user-1',
    });
  });
});
