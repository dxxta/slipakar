import { Router, type Request, type RequestHandler } from 'express';
import type { ProjectsUseCaseInterface } from '../../../../domain/projects/interface.js';
import { AppError } from '../../../../lib/app-error.js';
import { userId } from '../../../../lib/user-id.js';

function routeId(request: Request): string {
  const id = request.params.id;
  if (typeof id !== 'string') throw new AppError(400, 'VALIDATION', 'Invalid project ID');
  return id;
}

export function createProjectsRouter({ guards, useCase }: { guards: RequestHandler[]; useCase: ProjectsUseCaseInterface }): Router {
  const router = Router();
  router.use(...guards);

  /** @route POST /projects
   * @desc Create a project owned by the authenticated user. */
  router.post('/projects', async (request, response, next) => {
    try {
      const result = await useCase.createProjectUseCase({ payload: request.body, auditUserId: userId(response) });
      response.status(201).json(result);
    } catch (error) { next(error); }
  });

  /** @route GET /projects
   * @desc List projects owned by the authenticated user. */
  router.get('/projects', async (request, response, next) => {
    try {
      const result = await useCase.getProjectsUseCase({ query: request.query, auditUserId: userId(response) });
      response.status(200).json(result);
    } catch (error) { next(error); }
  });

  /** @route GET /projects/:id
   * @desc Get one owned project. */
  router.get('/projects/:id', async (request, response, next) => {
    try {
      const result = await useCase.getSingleProjectUseCase({ id: routeId(request), auditUserId: userId(response) });
      response.status(200).json(result);
    } catch (error) { next(error); }
  });

  /** @route PATCH /projects/:id
   * @desc Update one owned project. */
  router.patch('/projects/:id', async (request, response, next) => {
    try {
      const result = await useCase.updateProjectUseCase({ id: routeId(request), payload: request.body, auditUserId: userId(response) });
      response.status(200).json(result);
    } catch (error) { next(error); }
  });

  /** @route DELETE /projects/:id
   * @desc Delete one owned project. */
  router.delete('/projects/:id', async (request, response, next) => {
    try {
      const result = await useCase.deleteProjectUseCase({ id: routeId(request), auditUserId: userId(response) });
      response.status(200).json(result);
    } catch (error) { next(error); }
  });
  return router;
}
