import { Router, type Request, type RequestHandler } from 'express';
import type { NotificationsUseCaseInterface } from '../../../../domain/notifications/interface.js';
import { AppError } from '../../../../lib/app-error.js';
import { userId } from '../../../../lib/user-id.js';

function parameter(request: Request, name: string): string {
  const value = request.params[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppError(400, 'VALIDATION', 'Invalid route parameter');
  }
  return value;
}

export function createNotificationsRouter({
  guards,
  useCase,
}: {
  guards: RequestHandler[];
  useCase: NotificationsUseCaseInterface;
}): Router {
  const router = Router();
  router.use(...guards);

  /**
   * @route GET /notifications/unread-count
   * @desc Get the signed-in user's unread notification count.
   */
  router.get('/notifications/unread-count', async (_request, response, next) => {
    try {
      const result = await useCase.getUnreadNotificationsCountUseCase({ auditUserId: userId(response) });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @route GET /projects/:projectId/notifications
   * @desc List paginated notifications for a project.
   */
  router.get('/projects/:projectId/notifications', async (request, response, next) => {
    try {
      const result = await useCase.listNotificationsUseCase({
        projectId: parameter(request, 'projectId'),
        query: request.query,
        auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @route POST /projects/:projectId/notifications/read-all
   * @desc Mark all unread notifications in a project as read.
   */
  router.post('/projects/:projectId/notifications/read-all', async (request, response, next) => {
    try {
      const result = await useCase.markAllNotificationsReadUseCase({
        projectId: parameter(request, 'projectId'),
        auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @route POST /projects/:projectId/notifications/:id/read
   * @desc Mark one project notification as read.
   */
  router.post('/projects/:projectId/notifications/:id/read', async (request, response, next) => {
    try {
      const result = await useCase.markReadNotificationUseCase({
        projectId: parameter(request, 'projectId'),
        id: parameter(request, 'id'),
        auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
