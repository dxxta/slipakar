import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { requireAdmin } from './require-admin.js';
import { requireFeature } from './require-feature.js';

describe('requireFeature middleware', () => {
  it('requireFeature 404 when off and next() when on', async () => {
    const flags = {
      isEnabled: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
    };

    const mw = requireFeature(flags, 'scalar_docs');

    // Off -> next(AppError 404)
    const next1 = vi.fn();
    await mw({} as Request, {} as Response, next1);
    expect(next1).toHaveBeenCalledWith(
      expect.objectContaining({ status: 404, code: 'NOT_FOUND', message: 'Not found' }),
    );

    // On -> next() without error
    const next2 = vi.fn();
    await mw({} as Request, {} as Response, next2);
    expect(next2).toHaveBeenCalledWith();
  });
});

describe('requireAdmin middleware', () => {
  it('requireAdmin allows listed email case-insensitively and rejects others with 403', () => {
    const mw = requireAdmin(['Admin@Example.com', 'super@corp.org']);

    // Allowed (exact case match)
    const next1 = vi.fn();
    mw({ user: { email: 'Admin@Example.com' } } as unknown as Request, {} as Response, next1);
    expect(next1).toHaveBeenCalledWith();

    // Allowed (case-insensitive)
    const next2 = vi.fn();
    mw({ user: { email: 'ADMIN@EXAMPLE.COM' } } as unknown as Request, {} as Response, next2);
    expect(next2).toHaveBeenCalledWith();

    // Rejection 403 for other emails
    expect(() => {
      mw({ user: { email: 'user@example.com' } } as unknown as Request, {} as Response, vi.fn());
    }).toThrowError(expect.objectContaining({ status: 403, code: 'FORBIDDEN' }));

    // Rejection 401 when request.user is missing
    expect(() => {
      mw({} as unknown as Request, {} as Response, vi.fn());
    }).toThrowError(expect.objectContaining({ status: 401, code: 'UNAUTHENTICATED' }));
  });
});
