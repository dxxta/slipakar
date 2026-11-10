import { Router, type Request, type RequestHandler } from 'express';
import multer from 'multer';
import type { AttachmentsUseCaseInterface } from '../../../../domain/attachments/interface.js';
import { AppError } from '../../../../lib/app-error.js';
import { userId } from '../../../../lib/user-id.js';

const hardAttachmentLimit = 26_214_400; // 25MB

function parameter(request: Request, name: string): string {
  const value = request.params[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppError(400, 'VALIDATION', 'Invalid route parameter');
  }
  return value;
}

export function createAttachmentsRouter({
  guards,
  useCase,
}: {
  guards: RequestHandler[];
  useCase: AttachmentsUseCaseInterface;
}): Router {
  const router = Router();
  const base = '/projects/:projectId/attachments';
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: hardAttachmentLimit },
  });

  router.use(...guards);

  const acceptFile: RequestHandler = (request, response, next): void => {
    upload.single('file')(request, response, (error: unknown) => {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        next(new AppError(413, 'FILE_TOO_LARGE', 'File exceeds attachment limit'));
      } else if (error) {
        next(new AppError(400, 'MALFORMED_FILE', 'Invalid multipart upload'));
      } else {
        next();
      }
    });
  };

  const requireProject: RequestHandler = async (request, response, next): Promise<void> => {
    try {
      await useCase.assertProjectAttachmentsUseCase({
        projectId: parameter(request, 'projectId'),
        auditUserId: userId(response),
      });
      next();
    } catch (error) {
      next(error);
    }
  };

  /** @route POST /projects/:projectId/attachments
   * @desc Upload an attachment file for a project. */
  router.post(base, requireProject, acceptFile, async (request, response, next) => {
    try {
      if (!request.file) {
        throw new AppError(400, 'VALIDATION', 'File is required');
      }
      const result = await useCase.createAttachmentsUseCase({
        projectId: parameter(request, 'projectId'),
        auditUserId: userId(response),
        file: {
          buffer: request.file.buffer,
          fileName: request.file.originalname,
          contentType: request.file.mimetype || 'application/octet-stream',
        },
        payload: request.body,
      });
      response.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  /** @route GET /projects/:projectId/attachments
   * @desc List project attachments. */
  router.get(base, async (request, response, next) => {
    try {
      const campaignId = typeof request.query.campaignId === 'string' ? request.query.campaignId : undefined;
      const result = await useCase.findAllAttachmentsUseCase({
        projectId: parameter(request, 'projectId'),
        campaignId,
        auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /** @route GET /projects/:projectId/attachments/:id/content
   * @desc Stream an attachment's bytes. Images are served inline, everything else as a download. */
  router.get(`${base}/:id/content`, async (request, response, next) => {
    try {
      const file = await useCase.getContentAttachmentsUseCase({
        projectId: parameter(request, 'projectId'),
        id: parameter(request, 'id'),
        auditUserId: userId(response),
      });
      const safeName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      response
        .status(200)
        .setHeader('Content-Type', file.contentType)
        .setHeader('Content-Disposition', `${file.inline ? 'inline' : 'attachment'}; filename="${safeName}"`)
        .setHeader('X-Content-Type-Options', 'nosniff')
        .setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
        .setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
        .setHeader('Cache-Control', 'private, max-age=300')
        .send(file.buffer);
    } catch (error) {
      next(error);
    }
  });

  /** @route DELETE /projects/:projectId/attachments/:id
   * @desc Delete an attachment file from a project. */
  router.delete(`${base}/:id`, async (request, response, next) => {
    try {
      const result = await useCase.deleteAttachmentsUseCase({
        projectId: parameter(request, 'projectId'),
        id: parameter(request, 'id'),
        auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /** @route GET /projects/:projectId/storage
   * @desc Get current storage usage and quota. */
  router.get('/projects/:projectId/storage', async (request, response, next) => {
    try {
      const result = await useCase.getStorageUsageUseCase({
        projectId: parameter(request, 'projectId'),
        auditUserId: userId(response),
      });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
