import crypto from 'node:crypto';
import { Router } from 'express';
import type { MetricsInterface } from '../../../../domain/metrics/interface.js';

export function createMetricsRouter({
  metrics,
  token,
}: {
  metrics: MetricsInterface;
  token?: string;
}): Router {
  const router = Router();

  router.get('/metrics', async (req, res) => {
    if (token !== undefined) {
      const authHeader = req.headers.authorization;
      const expectedPrefix = 'Bearer ';

      if (!authHeader || !authHeader.startsWith(expectedPrefix)) {
        res.setHeader('WWW-Authenticate', 'Bearer');
        res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
          },
        });
        return;
      }

      const providedToken = authHeader.slice(expectedPrefix.length);
      const providedBuffer = Buffer.from(providedToken);
      const expectedBuffer = Buffer.from(token);

      const isMatch =
        providedBuffer.length === expectedBuffer.length &&
        crypto.timingSafeEqual(providedBuffer, expectedBuffer);

      if (!isMatch) {
        res.setHeader('WWW-Authenticate', 'Bearer');
        res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
          },
        });
        return;
      }
    }

    const body = await metrics.render();
    res.setHeader('Content-Type', metrics.contentType);
    res.status(200).send(body);
  });

  return router;
}
