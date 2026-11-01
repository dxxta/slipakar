import { Router, type RequestHandler } from 'express';
import type { UserNoticesUseCaseInterface } from '../../../../domain/user-notices/interface.js';
import { userId } from '../../../../lib/user-id.js';

export function createUserNoticesRouter({
  userGuards,
  useCase,
}: {
  userGuards: RequestHandler[];
  useCase: UserNoticesUseCaseInterface;
}): Router {
  const router = Router();

  router.get('/me/notices', ...userGuards, async (req, res, next) => {
    try {
      const currentUserId = userId(res);
      const result = await useCase.listNotices(currentUserId, req.query);
      res.status(200).json({
        message: 'User notices retrieved',
        data: result.data,
        metadata: result.metadata,
        success: true,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/me/notices/unread-count', ...userGuards, async (req, res, next) => {
    try {
      const currentUserId = userId(res);
      const result = await useCase.getUnreadCount(currentUserId);
      res.status(200).json({
        message: 'Unread notice count retrieved',
        data: result,
        success: true,
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/me/notices/:id/read', ...userGuards, async (req, res, next) => {
    try {
      const currentUserId = userId(res);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await useCase.markAsRead(currentUserId, id);
      res.status(200).json({
        message: 'Notice marked as read',
        data,
        success: true,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/me/notices/mark-all-read', ...userGuards, async (req, res, next) => {
    try {
      const currentUserId = userId(res);
      const data = await useCase.markAllAsRead(currentUserId);
      res.status(200).json({
        message: 'All notices marked as read',
        data,
        success: true,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
