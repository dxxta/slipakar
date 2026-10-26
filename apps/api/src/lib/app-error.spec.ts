import { describe, expect, it } from 'vitest';
import { AppError } from './app-error.js';

describe('AppError', () => {
  it('preserves status, code, and message', () => {
    const error = new AppError(404, 'NOT_FOUND', 'Missing');
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Missing');
  });

  it('preserves optional details', () => {
    expect(new AppError(400, 'VALIDATION', 'Validation failed', [{ path: ['name'] }]).details).toEqual([{ path: ['name'] }]);
  });
});
