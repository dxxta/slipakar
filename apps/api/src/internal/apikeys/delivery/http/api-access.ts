import { Router, type RequestHandler } from 'express';
import type { FeatureFlagsInterface } from '../../../../domain/system-config/interface.js';
import type { ApiKeyScope } from '../../../../domain/system-config/dto.js';
import { API_KEY_SCOPES } from '../../../../domain/system-config/dto.js';

export function createApiAccessRouter({ userGuards, adminGuards, isActive, envEnabled, allowedOrigins, flags }: { userGuards: RequestHandler[]; adminGuards: RequestHandler[]; isActive: () => Promise<boolean>; envEnabled: boolean; allowedOrigins: string[]; flags: FeatureFlagsInterface }): Router {
  const router = Router();
  router.get('/me/api-access', ...userGuards, async (_request, response, next) => {
    try { response.status(200).json({ message: 'API access status retrieved successfully', data: { active: await isActive(), scopes: API_KEY_SCOPES as readonly ApiKeyScope[] }, success: true }); }
    catch (error) { next(error); }
  });
  router.get('/admin/api-access', ...adminGuards, async (_request, response, next) => {
    try { response.status(200).json({ message: 'API access settings retrieved successfully', data: { environmentEnabled: envEnabled, allowedOrigins, runtimeEnabled: await flags.isEnabled('api_access_enabled') }, success: true }); }
    catch (error) { next(error); }
  });
  return router;
}
