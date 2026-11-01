import { Router, type RequestHandler } from 'express';
import type { PreferencesUseCaseInterface } from '../../../../domain/preferences/interface.js';
import { userId } from '../../../../lib/user-id.js';

export function createPreferencesRouter({
  guards,
  preferencesUseCase,
}: {
  guards: RequestHandler[];
  preferencesUseCase: PreferencesUseCaseInterface;
}): Router {
  const router = Router();

  router.get('/me/preferences', ...guards, async (req, res, next) => {
    try {
      const currentUserId = userId(res);
      const data = await preferencesUseCase.getPreferences(currentUserId);
      res.status(200).json({
        message: 'Preferences retrieved',
        data,
        success: true,
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/me/preferences', ...guards, async (req, res, next) => {
    try {
      const currentUserId = userId(res);
      const data = await preferencesUseCase.updatePreferences(currentUserId, req.body);
      res.status(200).json({
        message: 'Preferences updated',
        data,
        success: true,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
