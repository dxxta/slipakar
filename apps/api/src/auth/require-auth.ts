import type { RequestHandler } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { AppError } from '../lib/app-error.js';
import type { AuthUser } from './auth-user.js';

export type SessionLookup = (headers: Headers) => Promise<{ user: AuthUser } | null>;

export function createRequireAuth(getSession: SessionLookup): RequestHandler {
  return async (request, response, next): Promise<void> => {
    try {
      if (request.apiKey) { next(); return; }
      const session = await getSession(fromNodeHeaders(request.headers));
      if (!session) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
      }
      if (session.user.disabledAt) {
        throw new AppError(403, 'ACCOUNT_DISABLED', 'Account is disabled');
      }
      request.user = session.user;
      response.locals.userId = session.user.id;
      next();
    } catch (error) {
      next(error);
    }
  };
}
