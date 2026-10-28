import { Router, type Request, type RequestHandler } from 'express';
import multer from 'multer';
import type { UploadsUseCaseInterface } from '../../../../domain/uploads/interface.js';
import { AppError } from '../../../../lib/app-error.js';
import { userId } from '../../../../lib/user-id.js';

const hardFileLimit = 52_428_800;

function parameter(request: Request, name: string): string {
  const value = request.params[name];
  if (typeof value !== 'string' || value.length === 0) throw new AppError(400, 'VALIDATION', 'Invalid route parameter');
  return value;
}

export function createUploadsRouter({ guards, useCase }: { guards: RequestHandler[]; useCase: UploadsUseCaseInterface }): Router {
  const router = Router();
  const base = '/projects/:projectId/uploads';
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: hardFileLimit } });
  router.use(...guards);

  const acceptFile: RequestHandler = (request, response, next): void => {
    upload.single('file')(request, response, (error: unknown) => {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        next(new AppError(413, 'FILE_TOO_LARGE', 'File exceeds upload limit'));
      } else if (error) {
        next(new AppError(400, 'MALFORMED_FILE', 'Invalid multipart upload'));
      } else {
        next();
      }
    });
  };
  const requireProject: RequestHandler = async (request, response, next): Promise<void> => {
    try {
      await useCase.assertProjectUploadsUseCase({ projectId: parameter(request, 'projectId'), auditUserId: userId(response) });
      next();
    } catch (error) {
      next(error);
    }
  };

  /** @route POST /projects/:projectId/uploads
   * @desc Upload and parse a recipient data file. */
  router.post(base, requireProject, acceptFile, async (request, response, next) => {
    try {
      if (!request.file) throw new AppError(400, 'VALIDATION', 'File is required');
      const result = await useCase.createUploadsUseCase({
        projectId: parameter(request, 'projectId'), auditUserId: userId(response),
        payload: { buffer: request.file.buffer, fileName: request.file.originalname },
      });
      response.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  /** @route GET /projects/:projectId/uploads
   * @desc List project data uploads. */
  router.get(base, async (request, response, next) => {
    try {
      const result = await useCase.findAllUploadsUseCase({ projectId: parameter(request, 'projectId'), auditUserId: userId(response) });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /** @route GET /projects/:projectId/uploads/:id
   * @desc Get upload metadata and a five-row preview. */
  router.get(`${base}/:id`, async (request, response, next) => {
    try {
      const result = await useCase.findByIdUploadsUseCase({
        projectId: parameter(request, 'projectId'), id: parameter(request, 'id'), auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /** @route DELETE /projects/:projectId/uploads/:id
   * @desc Delete a project data upload. */
  router.delete(`${base}/:id`, async (request, response, next) => {
    try {
      const result = await useCase.deleteUploadsUseCase({
        projectId: parameter(request, 'projectId'), id: parameter(request, 'id'), auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });
  return router;
}
