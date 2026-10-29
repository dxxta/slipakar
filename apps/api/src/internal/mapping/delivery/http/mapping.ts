import { Router, type Request, type RequestHandler } from 'express';
import type { MappingUseCaseInterface } from '../../../../domain/mapping/interface.js';
import { AppError } from '../../../../lib/app-error.js';
import { userId } from '../../../../lib/user-id.js';

function projectId(request: Request): string {
  const id = request.params.projectId;
  if (typeof id !== 'string') throw new AppError(400, 'VALIDATION', 'Invalid project ID');
  return id;
}

export function createMappingRouter({ guards, useCase }: { guards: RequestHandler[]; useCase: MappingUseCaseInterface }): Router {
  const router = Router();
  router.use(...guards);

  /** @route PUT /projects/:projectId/mappings
   * @desc Create or update a field mapping. */
  router.put('/projects/:projectId/mappings', async (request, response, next) => {
    try {
      const result = await useCase.saveMappingUseCase({ projectId: projectId(request), payload: request.body, auditUserId: userId(response) });
      response.status(200).json(result);
    } catch (error) { next(error); }
  });

  /** @route GET /projects/:projectId/mappings
   * @desc Get a template and upload mapping. */
  router.get('/projects/:projectId/mappings', async (request, response, next) => {
    try {
      const result = await useCase.getMappingUseCase({ projectId: projectId(request), filter: request.query, auditUserId: userId(response) });
      response.status(200).json(result);
    } catch (error) { next(error); }
  });

  /** @route POST /projects/:projectId/preview
   * @desc Preview an email using a mapped upload row. */
  router.post('/projects/:projectId/preview', async (request, response, next) => {
    try {
      const result = await useCase.previewMappingUseCase({ projectId: projectId(request), payload: request.body, auditUserId: userId(response) });
      response.status(200).json(result);
    } catch (error) { next(error); }
  });
  return router;
}
