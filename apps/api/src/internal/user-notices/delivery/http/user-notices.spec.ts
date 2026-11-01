import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createUserNoticesRouter } from './user-notices.js';
import type { UserNoticesUseCaseInterface } from '../../../../domain/user-notices/interface.js';

describe('UserNotices HTTP router', () => {
  const mockUseCase: UserNoticesUseCaseInterface = {
    listNotices: vi.fn().mockResolvedValue({
      data: [{ id: 'n-1', title: 'Notice 1' }],
      metadata: { page: 1, limit: 20, total: 1 },
    }),
    getUnreadCount: vi.fn().mockResolvedValue({ unreadCount: 3 }),
    markAsRead: vi.fn().mockResolvedValue({ id: 'n-1', readAt: new Date() }),
    markAllAsRead: vi.fn().mockResolvedValue({ updatedCount: 3 }),
  };

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.userId = 'user-123';
    next();
  });
  app.use(
    createUserNoticesRouter({
      userGuards: [],
      useCase: mockUseCase,
    }),
  );

  it('GET /me/notices returns paginated user notices', async () => {
    const res = await request(app).get('/me/notices');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('GET /me/notices/unread-count returns unread count', async () => {
    const res = await request(app).get('/me/notices/unread-count');
    expect(res.status).toBe(200);
    expect(res.body.data.unreadCount).toBe(3);
  });
});
