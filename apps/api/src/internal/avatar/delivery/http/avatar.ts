import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import type { AvatarUseCaseInterface } from '../../../../domain/avatar/interface.js';
import { userId } from '../../../../lib/user-id.js';
import { AppError } from '../../../../lib/app-error.js';

export function createAvatarRouter({
  guards,
  useCase,
}: {
  guards: RequestHandler[];
  useCase: AvatarUseCaseInterface;
}): Router {
  const router = Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  });

  const uploadMiddleware: RequestHandler = (req, res, next) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(400, 'FILE_TOO_LARGE', 'Avatar file must not exceed 2 MB'));
      }
      if (err) {
        return next(new AppError(400, 'VALIDATION', 'File upload error'));
      }
      next();
    });
  };

  /**
   * @route POST /me/avatar
   * @desc Upload user avatar (PNG, JPEG, WebP, max 2MB).
   */
  router.post(
    '/me/avatar',
    ...guards,
    uploadMiddleware,
    async (request, response, next) => {
      try {
        const fileBuffer = request.file?.buffer;
        const currentUserId = userId(response);
        const result = await useCase.uploadAvatar({
          userId: currentUserId,
          fileBuffer,
        });
        response.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * @route GET /me/avatar/:userId
   * @desc Stream user avatar with caching and security headers.
   */
  router.get('/me/avatar/:userId', ...guards, async (request, response, next) => {
    try {
      const targetUserId = request.params.userId;
      if (typeof targetUserId !== 'string' || targetUserId.length === 0) {
        throw new AppError(400, 'VALIDATION', 'User ID required');
      }

      const result = await useCase.getAvatar({ userId: targetUserId });

      // Caching & Security headers
      response.setHeader('Content-Type', result.contentType);
      response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      response.setHeader('Vary', 'Accept');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('ETag', result.etag);

      if (request.header('If-None-Match') === result.etag) {
        response.status(304).end();
        return;
      }

      response.status(200).send(result.buffer);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @route DELETE /me/avatar
   * @desc Remove user avatar, resetting image to null.
   */
  router.delete('/me/avatar', ...guards, async (_request, response, next) => {
    try {
      const currentUserId = userId(response);
      const result = await useCase.deleteAvatar({ userId: currentUserId });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
