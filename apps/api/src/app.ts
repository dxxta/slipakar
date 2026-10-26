import express, {
  type Express,
  type RequestHandler,
  type Router,
} from 'express';
import type { ErrorReporter } from './domain/error-reporting/interface.js';
import { createErrorHandler } from './middleware/error-handler.js';

export type AppDeps = {
  // Trust proxy configuration for Express: false, boolean, number, or CIDR/IP string.
  trustProxy?: boolean | number | string;
  // Run before every router, for example request metrics.
  middleware?: RequestHandler[];
  // Mounted in the given order. Order matters: the auth router must come before
  // routers that apply requireAuth to every path (e.g. the projects router).
  routers?: Router[];
  // Receives unexpected (5xx) errors; never changes the HTTP answer.
  errorReporter?: ErrorReporter;
};

export function createApp(deps: AppDeps = {}): Express {
  const app = express();

  if (deps.trustProxy !== undefined) {
    if (deps.trustProxy === 'false' || deps.trustProxy === false) {
      app.set('trust proxy', false);
    } else if (deps.trustProxy === 'true' || deps.trustProxy === true) {
      app.set('trust proxy', true);
    } else if (typeof deps.trustProxy === 'string' && /^\d+$/.test(deps.trustProxy)) {
      app.set('trust proxy', Number(deps.trustProxy));
    } else {
      app.set('trust proxy', deps.trustProxy);
    }
  }

  for (const handler of deps.middleware ?? []) {
    app.use(handler);
  }

  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  for (const router of deps.routers ?? []) {
    app.use(router);
  }

  app.use(createErrorHandler({ errorReporter: deps.errorReporter }));

  return app;
}
