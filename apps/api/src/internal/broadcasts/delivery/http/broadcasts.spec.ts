import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createBroadcastsRouter } from './broadcasts.js';
import type { BroadcastUseCaseInterface } from '../../../../domain/broadcasts/interface.js';

describe('Broadcasts HTTP router', () => {
  const mockUseCase: BroadcastUseCaseInterface = {
    createBroadcast: vi.fn().mockResolvedValue({
      id: 'bc-1',
      subject: 'Subject',
      bodyText: 'Body',
      status: 'draft',
    }),
    getBroadcast: vi.fn().mockResolvedValue({
      id: 'bc-1',
      subject: 'Subject',
      bodyText: 'Body',
      status: 'draft',
    }),
    listBroadcasts: vi.fn().mockResolvedValue({
      data: [{ id: 'bc-1', subject: 'Subject' }],
      metadata: { page: 1, limit: 20, total: 1 },
    }),
    updateBroadcast: vi.fn().mockResolvedValue({
      id: 'bc-1',
      subject: 'Updated',
    }),
    deleteBroadcast: vi.fn().mockResolvedValue(undefined),
    previewBroadcast: vi.fn().mockResolvedValue({
      recipientCount: 10,
      sampleEmails: ['a***e@example.com'],
      renderedSubject: 'Subject',
      renderedBodyText: 'Body',
    }),
    sendBroadcast: vi.fn().mockResolvedValue({
      id: 'bc-1',
      status: 'sent',
      counts: { total: 10, sent: 10, failed: 0 },
    }),
  };

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.userId = 'admin-123';
    next();
  });
  app.use(
    createBroadcastsRouter({
      adminGuards: [],
      useCase: mockUseCase,
    }),
  );

  it('POST /admin/broadcasts creates draft broadcast', async () => {
    const res = await request(app)
      .post('/admin/broadcasts')
      .send({ subject: 'Test', bodyText: 'Body' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('POST /admin/broadcasts/:id/send sends broadcast', async () => {
    const res = await request(app).post('/admin/broadcasts/bc-1/send');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('sent');
  });
});
