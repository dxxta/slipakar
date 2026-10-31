import type { RequestHandler } from 'express';
import type { MetricsInterface } from '../../domain/metrics/interface.js';

export function requestMetrics(metrics: MetricsInterface): RequestHandler {
  return (req, res, next) => {
    // Skip recording requests to /metrics
    if (req.path === '/metrics' || req.originalUrl?.split('?')[0] === '/metrics') {
      return next();
    }

    const startHr = process.hrtime.bigint();

    res.once('finish', () => {
      const endHr = process.hrtime.bigint();
      const durationSeconds = Number(endHr - startHr) / 1e9;

      let route = 'unmatched';
      if (req.route && typeof req.route.path === 'string') {
        const base = req.baseUrl || '';
        route = `${base}${req.route.path}`;
      }

      metrics.recordHttpRequest({
        method: req.method,
        route,
        status: res.statusCode,
        durationSeconds,
      });
    });

    next();
  };
}
