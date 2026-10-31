import { Router, type Request, type RequestHandler } from 'express';
import type { AdminUsersUseCaseInterface } from '../../../../domain/admin-users/interface.js';
import { AppError } from '../../../../lib/app-error.js';
import { userId } from '../../../../lib/user-id.js';

function parameter(request: Request, name: string): string {
  const value = request.params[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppError(400, 'VALIDATION', 'Invalid route parameter');
  }
  return value;
}

export function createAdminUsersRouter({
  guards,
  useCase,
}: {
  guards: RequestHandler[];
  useCase: AdminUsersUseCaseInterface;
}): Router {
  const router = Router();
  router.use(...guards);

  /**
   * @route GET /admin/users
   * @desc List all users with pagination, search, and sorting.
   */
  router.get('/admin/users', async (request, response, next) => {
    try {
      const result = await useCase.listUsers({
        query: request.query,
        auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @route GET /admin/users/:id
   * @desc Get user by id.
   */
  router.get('/admin/users/:id', async (request, response, next) => {
    try {
      const result = await useCase.getUser({
        id: parameter(request, 'id'),
        auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @route PATCH /admin/users/:id
   * @desc Update user profile (name, image only).
   */
  router.patch('/admin/users/:id', async (request, response, next) => {
    try {
      const result = await useCase.updateUser({
        id: parameter(request, 'id'),
        payload: request.body,
        auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @route POST /admin/users/:id/disable
   * @desc Disable a user and revoke their sessions.
   */
  router.post('/admin/users/:id/disable', async (request, response, next) => {
    try {
      const result = await useCase.disableUser({
        id: parameter(request, 'id'),
        payload: request.body,
        auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @route POST /admin/users/:id/enable
   * @desc Re-enable a disabled user.
   */
  router.post('/admin/users/:id/enable', async (request, response, next) => {
    try {
      const result = await useCase.enableUser({
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
