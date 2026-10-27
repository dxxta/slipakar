import { Router, type Request, type RequestHandler } from 'express';
import type { AuditUseCaseInterface } from '../../../../domain/audit/interface.js';
import { AppError } from '../../../../lib/app-error.js';
import { userId } from '../../../../lib/user-id.js';

function param(request: Request, key: string): string {
  const value = request.params[key];
  if (typeof value !== 'string' || !value) throw new AppError(400, 'VALIDATION', 'Invalid route parameter');
  return value;
}

export function createAuditRouter({
  guards,
  useCase,
}: {
  guards: RequestHandler[];
  useCase: AuditUseCaseInterface;
}): Router {
  const router = Router();
  router.use(...guards);

  /**
   * @route GET /projects/:projectId/activity
   * @desc List paginated audit activity for a project and its child entities.
   */
  router.get('/projects/:projectId/activity', async (request, response, next) => {
    try {
      const result = await useCase.listProjectActivityUseCase({
        projectId: param(request, 'projectId'),
        query: request.query,
        auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
