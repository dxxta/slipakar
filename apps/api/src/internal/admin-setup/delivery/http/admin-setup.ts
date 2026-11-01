import { Router, type RequestHandler, type Response } from 'express';
import type { AdminSetupUseCaseInterface } from '../../../../domain/admin-setup/interface.js';

export function createAdminSetupRouter({
  guards,
  useCase,
}: {
  guards: RequestHandler[];
  useCase: AdminSetupUseCaseInterface;
}): Router {
  const router = Router();

  const getUserId = (res: Response): string => {
    return (
      (res.locals as { userId?: string; user?: { id?: string } })?.userId ??
      (res.locals as { userId?: string; user?: { id?: string } })?.user?.id ??
      'system'
    );
  };

  // GET /admin/setup
  router.get('/admin/setup', ...guards, async (_req, res, next) => {
    try {
      const data = await useCase.getSetup();
      res.status(200).json({
        message: 'Admin setup retrieved',
        data,
        success: true,
      });
    } catch (err) {
      next(err);
    }
  });

  // PUT /admin/setup/:key
  router.put('/admin/setup/:key', ...guards, async (req, res, next) => {
    try {
      const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
      const userId = getUserId(res);
      const data = await useCase.updateIntegration(key, req.body, userId);
      res.status(200).json({
        message: 'Integration configured',
        data,
        success: true,
      });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /admin/setup/:key
  router.delete('/admin/setup/:key', ...guards, async (req, res, next) => {
    try {
      const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
      const userId = getUserId(res);
      const data = await useCase.deleteIntegration(key, userId);
      res.status(200).json({
        message: 'Integration cleared',
        data,
        success: true,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /admin/setup/mail/test-send
  router.post('/admin/setup/mail/test-send', ...guards, async (req, res, next) => {
    try {
      const userId = getUserId(res);
      const result = await useCase.testSendMail(req.body?.to, userId);
      res.status(200).json({
        message: result.ok ? 'Test email sent successfully' : 'Test email failed',
        data: result,
        success: true,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /admin/setup/:key/test
  router.post('/admin/setup/:key/test', ...guards, async (req, res, next) => {
    try {
      const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
      const data = await useCase.testIntegration(key);
      res.status(200).json({
        message: 'Integration test executed',
        data,
        success: true,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
