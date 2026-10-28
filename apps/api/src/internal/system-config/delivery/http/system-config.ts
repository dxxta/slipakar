import { Router, type Request, type RequestHandler } from 'express';
import type { SystemConfigUseCaseInterface } from '../../../../domain/system-config/interface.js';
import { AppError } from '../../../../lib/app-error.js';
import { userId } from '../../../../lib/user-id.js';

function parameter(request: Request, name: string): string {
  const value = request.params[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppError(400, 'VALIDATION', 'Invalid route parameter');
  }
  return value;
}

export function createSystemConfigRouter({
  guards,
  useCase,
}: {
  guards: RequestHandler[];
  useCase: SystemConfigUseCaseInterface;
}): Router {
  const router = Router();
  router.use(...guards);

  /**
   * @route GET /admin/config
   * @desc List all system config feature flags with effective values.
   */
  router.get('/admin/config', async (_request, response, next) => {
    try {
      const result = await useCase.getSystemConfigUseCase({
        auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @route PUT /admin/config/:key
   * @desc Update a system config feature flag value.
   */
  router.put('/admin/config/:key', async (request, response, next) => {
    try {
      const result = await useCase.updateSystemConfigUseCase({
        key: parameter(request, 'key'),
        payload: request.body,
        auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
