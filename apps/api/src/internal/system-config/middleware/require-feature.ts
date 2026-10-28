import type { RequestHandler } from 'express';
import type { SystemConfigKey } from '../../../domain/system-config/dto.js';
import type { FeatureFlagsInterface } from '../../../domain/system-config/interface.js';
import { AppError } from '../../../lib/app-error.js';

export function requireFeature(
  flags: Pick<FeatureFlagsInterface, 'isEnabled'>,
  key: SystemConfigKey,
): RequestHandler {
  return async (_req, _res, next) => {
    try {
      const enabled = await flags.isEnabled(key);
      if (!enabled) {
        throw new AppError(404, 'NOT_FOUND', 'Not found');
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
