import type { RequestHandler } from 'express';
import { AppError } from '../../../lib/app-error.js';

export function requireAdmin(adminEmails: string[]): RequestHandler {
  const adminSet = new Set(adminEmails.map((email) => email.trim().toLowerCase()));

  return (req, _res, next) => {
    if (!req.user || typeof req.user.email !== 'string') {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    const email = req.user.email.trim().toLowerCase();
    if (!adminSet.has(email)) {
      throw new AppError(403, 'FORBIDDEN', 'Admin access required');
    }

    next();
  };
}
