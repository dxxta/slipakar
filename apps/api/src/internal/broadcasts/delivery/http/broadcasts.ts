import { Router, type RequestHandler } from 'express';
import type { BroadcastUseCaseInterface } from '../../../../domain/broadcasts/interface.js';
import { userId } from '../../../../lib/user-id.js';

export function createBroadcastsRouter({
  adminGuards,
  useCase,
}: {
  adminGuards: RequestHandler[];
  useCase: BroadcastUseCaseInterface;
}): Router {
  const router = Router();

  router.post('/admin/broadcasts', ...adminGuards, async (req, res, next) => {
    try {
      const adminUserId = userId(res);
      const data = await useCase.createBroadcast(adminUserId, req.body);
      res.status(201).json({
        message: 'Broadcast created',
        data,
        success: true,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/admin/broadcasts', ...adminGuards, async (req, res, next) => {
    try {
      const result = await useCase.listBroadcasts(req.query);
      res.status(200).json({
        message: 'Broadcasts retrieved',
        data: result.data,
        metadata: result.metadata,
        success: true,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/admin/broadcasts/:id', ...adminGuards, async (req, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await useCase.getBroadcast(id);
      res.status(200).json({
        message: 'Broadcast retrieved',
        data,
        success: true,
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/admin/broadcasts/:id', ...adminGuards, async (req, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await useCase.updateBroadcast(id, req.body);
      res.status(200).json({
        message: 'Broadcast updated',
        data,
        success: true,
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/admin/broadcasts/:id', ...adminGuards, async (req, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await useCase.deleteBroadcast(id);
      res.status(200).json({
        message: 'Broadcast deleted',
        data: null,
        success: true,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/admin/broadcasts/:id/preview', ...adminGuards, async (req, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await useCase.previewBroadcast(id);
      res.status(200).json({
        message: 'Broadcast preview generated',
        data,
        success: true,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/admin/broadcasts/:id/send', ...adminGuards, async (req, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await useCase.sendBroadcast(id);
      res.status(200).json({
        message: 'Broadcast sent',
        data,
        success: true,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
