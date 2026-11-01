import { Router, type RequestHandler } from 'express';
import type { DemoProjectUseCaseInterface } from '../../../../domain/demo-project/interface.js';
import { userId } from '../../../../lib/user-id.js';

export function createDemoProjectRouter({
  guards,
  useCase,
}: {
  guards: RequestHandler[];
  useCase: DemoProjectUseCaseInterface;
}): Router {
  const router = Router();
  router.use(...guards);

  /**
   * @route POST /admin/demo-project
   * @desc Seed an example demo project (idempotent, returns 200).
   */
  router.post('/admin/demo-project', async (_request, response, next) => {
    try {
      const currentUserId = userId(response);
      const result = await useCase.seedDemoProjectUseCase({
        userId: currentUserId,
      });
      response.status(200).json(result);
    } catch (error) {
      console.error('DEBUG SEED ERROR CAUGHT:', error);
      next(error);
    }
  });

  return router;
}
