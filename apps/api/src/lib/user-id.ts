import type { Response } from 'express';
import { AppError } from './app-error.js';

export function userId(response: Response): string {
  const id: unknown = response.locals.userId;
  if (typeof id !== 'string' || id.length === 0) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  }
  return id;
}
