import { Router, type Request, type RequestHandler } from 'express';
import type { TemplatesUseCaseInterface } from '../../../../domain/templates/interface.js';
import { AppError } from '../../../../lib/app-error.js';
import { userId } from '../../../../lib/user-id.js';
import { assertSafeTemplate } from '../../renderer/template-renderer.js';

function param(request: Request, key: string): string {
  const value = request.params[key];
  if (typeof value !== 'string' || !value) throw new AppError(400, 'VALIDATION', 'Invalid route parameter');
  return value;
}

const checkSafeBody: RequestHandler = (request, _response, next): void => {
  try {
    const body: unknown = request.body;
    if (typeof body === 'object' && body !== null) {
      const subject: unknown = Reflect.get(body, 'subject');
      const bodyHtml: unknown = Reflect.get(body, 'bodyHtml');
      if (typeof subject === 'string') assertSafeTemplate(subject);
      if (typeof bodyHtml === 'string') assertSafeTemplate(bodyHtml);
    }
    next();
  } catch (error) { next(error); }
};

export function createTemplatesRouter({ guards, useCase }: { guards: RequestHandler[]; useCase: TemplatesUseCaseInterface }): Router {
  const router = Router();
  router.use(...guards);
  const base = '/projects/:projectId/templates';

  /** @route POST /projects/:projectId/templates @desc Create an email template. */
  router.post(base, checkSafeBody, async (request, response, next) => {
    try {
      const result = await useCase.createTemplateUseCase({ projectId: param(request, 'projectId'), payload: request.body, auditUserId: userId(response) });
      response.status(201).json(result);
    } catch (error) { next(error); }
  });
  /** @route GET /projects/:projectId/templates @desc List email templates. */
  router.get(base, async (request, response, next) => {
    try {
      const result = await useCase.listTemplateUseCase({ projectId: param(request, 'projectId'), query: request.query, auditUserId: userId(response) });
      response.status(200).json(result);
    } catch (error) { next(error); }
  });
  /** @route GET /projects/:projectId/templates/:id @desc Read an email template. */
  router.get(`${base}/:id`, async (request, response, next) => {
    try {
      const result = await useCase.getTemplateUseCase({ projectId: param(request, 'projectId'), id: param(request, 'id'), auditUserId: userId(response) });
      response.status(200).json(result);
    } catch (error) { next(error); }
  });
  /** @route PATCH /projects/:projectId/templates/:id @desc Update an email template. */
  router.patch(`${base}/:id`, checkSafeBody, async (request, response, next) => {
    try {
      const result = await useCase.updateTemplateUseCase({ projectId: param(request, 'projectId'), id: param(request, 'id'), payload: request.body, auditUserId: userId(response) });
      response.status(200).json(result);
    } catch (error) { next(error); }
  });
  /** @route DELETE /projects/:projectId/templates/:id @desc Delete an email template. */
  router.delete(`${base}/:id`, async (request, response, next) => {
    try {
      const result = await useCase.deleteTemplateUseCase({ projectId: param(request, 'projectId'), id: param(request, 'id'), auditUserId: userId(response) });
      response.status(200).json(result);
    } catch (error) { next(error); }
  });
  return router;
}
