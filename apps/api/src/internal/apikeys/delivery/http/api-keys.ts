import { Router, type Request, type RequestHandler } from 'express';
import type { ApiKeysUseCaseInterface } from '../../../../domain/apikeys/interface.js';
import { AppError } from '../../../../lib/app-error.js';
import { userId } from '../../../../lib/user-id.js';

function param(request: Request, key: string): string { const value = request.params[key]; if (typeof value !== 'string' || !value) throw new AppError(400, 'VALIDATION', 'Invalid route parameter'); return value; }
export function createApiKeysRouter({ guards, useCase }: { guards: RequestHandler[]; useCase: ApiKeysUseCaseInterface }): Router {
  const router = Router(); router.use(...guards); const base = '/projects/:projectId/api-keys';
  /** @route GET /projects/:projectId/api-keys @desc List project API keys without their secret hashes. */
  router.get(base, async (request, response, next) => { try { response.status(200).json(await useCase.list({ projectId: param(request, 'projectId'), userId: userId(response) })); } catch (error) { next(error); } });
  /** @route POST /projects/:projectId/api-keys @desc Create a project API key; the secret is returned once. */
  router.post(base, async (request, response, next) => { try { response.status(201).json(await useCase.create({ projectId: param(request, 'projectId'), userId: userId(response), payload: request.body })); } catch (error) { next(error); } });
  /** @route DELETE /projects/:projectId/api-keys/:id @desc Revoke a project API key. */
  router.delete(`${base}/:id`, async (request, response, next) => { try { response.status(200).json(await useCase.revoke({ projectId: param(request, 'projectId'), userId: userId(response), id: param(request, 'id') })); } catch (error) { next(error); } });
  return router;
}
