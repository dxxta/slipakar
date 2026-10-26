import type { ZodType } from 'zod';
import { AppError } from './app-error.js';

export function validateAndThrow<T>({ schema, data }: { schema: ZodType<T>; data: unknown }): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new AppError(400, 'VALIDATION', 'Validation failed', result.error.issues);
  return result.data;
}
