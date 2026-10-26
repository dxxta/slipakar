import type { Request, RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

export type ValidationSource = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, source: ValidationSource): RequestHandler {
  return (request, response, next): void => {
    const result = schema.safeParse(request[source]);
    if (!result.success) {
      response.status(400).json({
        error: {
          code: 'VALIDATION',
          message: 'Validation failed',
          details: result.error.issues,
        },
      });
      return;
    }

    if (source === 'query') {
      Object.defineProperty(request, 'query', { value: result.data, configurable: true, writable: true });
    } else if (source === 'body') {
      request.body = result.data;
    } else {
      request.params = result.data as Request['params'];
    }
    next();
  };
}
