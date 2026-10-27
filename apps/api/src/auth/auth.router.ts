import { Router, type Router as ExpressRouter } from 'express';
import { toNodeHandler } from 'better-auth/node';
import type { createAuth } from './auth.js';

export function createAuthRouter(auth: ReturnType<typeof createAuth>): ExpressRouter {
  const router = Router();
  const handler = toNodeHandler(auth);
  router.use('/api/auth', (request, response, next): void => {
    void (async (): Promise<void> => {
      const origin = request.get('origin');
      const isSafeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(request.method);
      if (origin && !isSafeMethod && !(await auth.$context).isTrustedOrigin(origin)) {
        response.status(403).json({ message: 'Invalid origin', code: 'INVALID_ORIGIN' });
        return;
      }
      await handler(request, response);
    })().catch(next);
  });
  return router;
}
