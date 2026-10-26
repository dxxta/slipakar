import type { ErrorRequestHandler } from 'express';
import type { ErrorReporter } from '../domain/error-reporting/interface.js';
import { AppError } from '../lib/app-error.js';
import { logger } from '../lib/logger.js';

export function createErrorHandler({ errorReporter }: { errorReporter?: ErrorReporter } = {}): ErrorRequestHandler {
  return (error: unknown, request, response, _next): void => {
    void _next;
    if (error instanceof AppError) {
      response.status(error.status).json({ error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      } });
      if (error.status >= 500) report(errorReporter, error, request.method, request.baseUrl + (request.route?.path ?? ''), error.status);
      return;
    }

    logger.error({ errorType: error instanceof Error ? error.name : typeof error }, 'Unhandled request error');
    report(errorReporter, error, request.method, request.baseUrl + (request.route?.path ?? ''), 500);
    response.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
  };
}

// Only the route pattern is reported, never the concrete URL, query or body.
function report(errorReporter: ErrorReporter | undefined, error: unknown, method: string, route: string, status: number): void {
  try {
    errorReporter?.capture(error, { method, route, status });
  } catch {
    // Reporting must never change the HTTP answer.
  }
}

export const errorHandler: ErrorRequestHandler = createErrorHandler();
