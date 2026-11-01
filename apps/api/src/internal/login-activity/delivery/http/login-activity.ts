import { Router, type RequestHandler } from 'express';
import type { LoginActivityUseCaseInterface } from '../../../../domain/login-activity/interface.js';
import { userId } from '../../../../lib/user-id.js';

export function createLoginActivityRouter({
  userGuards,
  adminGuards,
  useCase,
}: {
  userGuards: RequestHandler[];
  adminGuards: RequestHandler[];
  useCase: LoginActivityUseCaseInterface;
}): Router {
  const router = Router();

  router.get('/me/login-activity', ...userGuards, async (req, res, next) => {
    try {
      const currentUserId = userId(res);
      const result = await useCase.getUserActivity(currentUserId, req.query);
      res.status(200).json({
        message: 'Login activity retrieved',
        data: result.data,
        metadata: result.metadata,
        success: true,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/admin/login-activity', ...adminGuards, async (req, res, next) => {
    try {
      const result = await useCase.getAdminActivity(req.query);
      res.status(200).json({
        message: 'All login activity retrieved',
        data: result.data,
        metadata: result.metadata,
        success: true,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
