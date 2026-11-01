import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createPreferencesRouter } from './preferences.js';
import type { PreferencesUseCaseInterface } from '../../../../domain/preferences/interface.js';

describe('Preferences HTTP router', () => {
  const mockUseCase: PreferencesUseCaseInterface = {
    getPreferences: vi.fn().mockResolvedValue({
      themeMode: 'system',
      themeAccent: 'slate',
    }),
    updatePreferences: vi.fn().mockResolvedValue({
      themeMode: 'dark',
      themeAccent: 'violet',
    }),
  };

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.userId = 'user-123';
    next();
  });
  app.use(createPreferencesRouter({ guards: [], preferencesUseCase: mockUseCase }));

  it('GET /me/preferences returns {message, data, success}', async () => {
    const res = await request(app).get('/me/preferences');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'Preferences retrieved',
      data: {
        themeMode: 'system',
        themeAccent: 'slate',
      },
      success: true,
    });
  });

  it('PATCH /me/preferences returns {message, data, success}', async () => {
    const res = await request(app)
      .patch('/me/preferences')
      .send({ themeMode: 'dark', themeAccent: 'violet' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'Preferences updated',
      data: {
        themeMode: 'dark',
        themeAccent: 'violet',
      },
      success: true,
    });
  });
});
