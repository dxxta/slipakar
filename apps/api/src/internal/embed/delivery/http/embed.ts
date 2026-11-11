import { Router, type RequestHandler } from 'express';
import { AppError } from '../../../../lib/app-error.js';
import type { EmbedUseCaseInterface } from '../../../../domain/embed/interface.js';

function routeParam(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || !value) throw new AppError(400, 'VALIDATION', 'Invalid project ID');
  return value;
}

export function createEmbedRouter({ useCase, isActive }: { useCase: EmbedUseCaseInterface; isActive: () => Promise<boolean> }): Router {
  const router = Router();
  const mintHandler: RequestHandler = async (request, response, next) => {
    try {
      if (!(await isActive())) throw new AppError(404, 'NOT_FOUND', 'Resource not found');
      const identity = request.apiKey;
      if (!identity || identity.embed) throw new AppError(403, 'API_KEY_SCOPE_DENIED', 'A project API key with embed:create is required');
      const projectId = routeParam(request.params.projectId);
      if (identity.projectId !== projectId) throw new AppError(403, 'API_KEY_SCOPE_DENIED', 'API key is bound to another project');
      response.status(201).json(await useCase.mint({ projectId, keyId: identity.id, keyScopes: identity.scopes, payload: request.body }));
    } catch (error) { next(error); }
  };
  /** @route POST /projects/:projectId/embed-tokens @desc Create a single-use launch URL for an allowed parent origin. */
  router.post('/projects/:projectId/embed-tokens', mintHandler);
  /** @route POST /embed/exchange @desc Exchange a single-use launch token for a short-lived embed session. */
  router.post('/embed/exchange', async (request, response, next) => {
    try { response.status(200).json(await useCase.exchange({ payload: request.body, ip: request.ip ?? request.socket.remoteAddress ?? 'unknown' })); }
    catch (error) { next(error); }
  });
  return router;
}
