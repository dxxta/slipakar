import { Router, type Request, type RequestHandler } from 'express';
import type { SmtpUseCaseInterface } from '../../../../domain/smtp/interface.js';
import { AppError } from '../../../../lib/app-error.js';
import { userId } from '../../../../lib/user-id.js';

function param(request: Request, key: string): string {
  const value = request.params[key];
  if (typeof value !== 'string' || !value) throw new AppError(400, 'VALIDATION', 'Invalid route parameter');
  return value;
}

export function createSmtpRouter({ guards, useCase }: { guards: RequestHandler[]; useCase: SmtpUseCaseInterface }): Router {
  const router = Router();
  router.use(...guards);
  const base = '/projects/:projectId/smtp';

  /** @route POST /projects/:projectId/smtp @desc Create an SMTP connection. */
  router.post(base, async (request, response, next) => {
    try {
      const result = await useCase.createSmtpUseCase({ projectId: param(request, 'projectId'), payload: request.body, auditUserId: userId(response) });
      response.status(201).json(result);
    } catch (error) { next(error); }
  });
  /** @route GET /projects/:projectId/smtp @desc List SMTP connections. */
  router.get(base, async (request, response, next) => {
    try {
      const result = await useCase.listSmtpUseCase({ projectId: param(request, 'projectId'), query: request.query, auditUserId: userId(response) });
      response.status(200).json(result);
    } catch (error) { next(error); }
  });
  /** @route GET /projects/:projectId/smtp/:id @desc Read an SMTP connection. */
  router.get(`${base}/:id`, async (request, response, next) => {
    try {
      const result = await useCase.getSmtpUseCase({ projectId: param(request, 'projectId'), id: param(request, 'id'), auditUserId: userId(response) });
      response.status(200).json(result);
    } catch (error) { next(error); }
  });
  /** @route PATCH /projects/:projectId/smtp/:id @desc Update an SMTP connection. */
  router.patch(`${base}/:id`, async (request, response, next) => {
    try {
      const result = await useCase.updateSmtpUseCase({ projectId: param(request, 'projectId'), id: param(request, 'id'), payload: request.body, auditUserId: userId(response) });
      response.status(200).json(result);
    } catch (error) { next(error); }
  });
  /** @route DELETE /projects/:projectId/smtp/:id @desc Delete an SMTP connection. */
  router.delete(`${base}/:id`, async (request, response, next) => {
    try {
      const result = await useCase.deleteSmtpUseCase({ projectId: param(request, 'projectId'), id: param(request, 'id'), auditUserId: userId(response) });
      response.status(200).json(result);
    } catch (error) { next(error); }
  });
  /** @route POST /projects/:projectId/smtp/:id/test @desc Test an SMTP connection. */
  router.post(`${base}/:id/test`, async (request, response, next) => {
    try {
      const result = await useCase.testSmtpUseCase({ projectId: param(request, 'projectId'), id: param(request, 'id'), auditUserId: userId(response) });
      response.status(200).json(result);
    } catch (error) { next(error); }
  });
  return router;
}
