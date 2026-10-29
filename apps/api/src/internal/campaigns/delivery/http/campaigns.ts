import { Router, type Request, type RequestHandler } from 'express';
import type { CampaignsUseCaseInterface } from '../../../../domain/campaigns/interface.js';
import { AppError } from '../../../../lib/app-error.js';
import { userId } from '../../../../lib/user-id.js';

function parameter(request: Request, name: string): string {
  const value = request.params[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppError(400, 'VALIDATION', 'Invalid route parameter');
  }
  return value;
}

export function createCampaignsRouter({
  guards,
  useCase,
}: {
  guards: RequestHandler[];
  useCase: CampaignsUseCaseInterface;
}): Router {
  const router = Router();
  const base = '/projects/:projectId/campaigns';

  router.use(...guards);

  /** @route POST /projects/:projectId/campaigns
   * @desc Create a new campaign with recipients. */
  router.post(base, async (request, response, next) => {
    try {
      const result = await useCase.createCampaignsUseCase({
        projectId: parameter(request, 'projectId'),
        payload: request.body,
        auditUserId: userId(response),
      });
      response.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  /** @route GET /projects/:projectId/campaigns
   * @desc List campaigns in a project. */
  router.get(base, async (request, response, next) => {
    try {
      const result = await useCase.findAllCampaignsUseCase({
        projectId: parameter(request, 'projectId'),
        query: request.query,
        auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /** @route GET /projects/:projectId/campaigns/:id
   * @desc Get campaign details and recipient status counts. */
  router.get(`${base}/:id`, async (request, response, next) => {
    try {
      const result = await useCase.findByIdCampaignsUseCase({
        projectId: parameter(request, 'projectId'),
        id: parameter(request, 'id'),
        auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /** @route POST /projects/:projectId/campaigns/:id/send
   * @desc Trigger campaign sending and enqueue recipients. */
  router.post(`${base}/:id/send`, async (request, response, next) => {
    try {
      const result = await useCase.sendCampaignsUseCase({
        projectId: parameter(request, 'projectId'),
        id: parameter(request, 'id'),
        auditUserId: userId(response),
      });
      response.status(202).json(result);
    } catch (error) {
      next(error);
    }
  });

  /** @route GET /projects/:projectId/campaigns/:id/recipients
   * @desc Get paginated list of campaign recipients with optional status filter. */
  router.get(`${base}/:id/recipients`, async (request, response, next) => {
    try {
      const result = await useCase.getRecipientsCampaignsUseCase({
        projectId: parameter(request, 'projectId'),
        campaignId: parameter(request, 'id'),
        query: request.query,
        auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /** @route POST /projects/:projectId/campaigns/:campaignId/recipients/:recipientId/retry
   * @desc Retry sending to a failed recipient. */
  router.post(`${base}/:campaignId/recipients/:recipientId/retry`, async (request, response, next) => {
    try {
      const result = await useCase.retryRecipientCampaignsUseCase({
        projectId: parameter(request, 'projectId'),
        campaignId: parameter(request, 'campaignId'),
        recipientId: parameter(request, 'recipientId'),
        auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
