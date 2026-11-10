import { Router, type Request, type RequestHandler } from 'express';
import type { PdfTemplatesUseCaseInterface } from '../../../../domain/pdf-templates/interface.js';
import { AppError } from '../../../../lib/app-error.js';
import { userId } from '../../../../lib/user-id.js';

function parameter(request: Request, name: string): string {
  const value = request.params[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppError(400, 'VALIDATION', 'Invalid route parameter');
  }
  return value;
}

export function createPdfTemplatesRouter({
  guards,
  useCase,
}: {
  guards: RequestHandler[];
  useCase: PdfTemplatesUseCaseInterface;
}): Router {
  const router = Router();
  const base = '/projects/:projectId/pdf-templates';

  router.use(...guards);

  /** @route POST /projects/:projectId/pdf-templates
   * @desc Create a new PDF template. */
  router.post(base, async (request, response, next) => {
    try {
      const result = await useCase.createPdfTemplatesUseCase({
        projectId: parameter(request, 'projectId'),
        payload: request.body,
        auditUserId: userId(response),
      });
      response.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  /** @route GET /projects/:projectId/pdf-templates
   * @desc List PDF templates for a project. */
  router.get(base, async (request, response, next) => {
    try {
      const result = await useCase.listPdfTemplatesUseCase({
        projectId: parameter(request, 'projectId'),
        query: request.query,
        auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /** @route POST /projects/:projectId/pdf-templates/preview
   * @desc Render the unsaved node tree to a PDF with sample values for a print preview. */
  router.post(`${base}/preview`, async (request, response, next) => {
    try {
      const pdf = await useCase.previewPdfTemplatesUseCase({
        projectId: parameter(request, 'projectId'),
        payload: request.body,
        auditUserId: userId(response),
      });
      response
        .status(200)
        .setHeader('Content-Type', 'application/pdf')
        .setHeader('Content-Disposition', 'inline; filename="preview.pdf"')
        .setHeader('Cache-Control', 'no-store')
        .send(pdf);
    } catch (error) {
      next(error);
    }
  });

  /** @route GET /projects/:projectId/pdf-templates/:id
   * @desc Get a single PDF template by ID. */
  router.get(`${base}/:id`, async (request, response, next) => {
    try {
      const result = await useCase.getPdfTemplatesUseCase({
        projectId: parameter(request, 'projectId'),
        id: parameter(request, 'id'),
        auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /** @route PATCH /projects/:projectId/pdf-templates/:id
   * @desc Update an existing PDF template. */
  router.patch(`${base}/:id`, async (request, response, next) => {
    try {
      const result = await useCase.updatePdfTemplatesUseCase({
        projectId: parameter(request, 'projectId'),
        id: parameter(request, 'id'),
        payload: request.body,
        auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /** @route DELETE /projects/:projectId/pdf-templates/:id
   * @desc Delete a PDF template from a project. */
  router.delete(`${base}/:id`, async (request, response, next) => {
    try {
      const result = await useCase.deletePdfTemplatesUseCase({
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
