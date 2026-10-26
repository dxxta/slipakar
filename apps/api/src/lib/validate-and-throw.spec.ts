import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validateAndThrow } from './validate-and-throw.js';

describe('validateAndThrow', () => {
  it('returns parsed data with defaults', () => {
    const schema = z.object({ name: z.string(), enabled: z.boolean().default(true) });
    expect(validateAndThrow({ schema, data: { name: 'Payroll' } })).toEqual({ name: 'Payroll', enabled: true });
  });

  it('throws a validation AppError with Zod issues', () => {
    const schema = z.object({ name: z.string().min(1) });
    expect(() => validateAndThrow({ schema, data: { name: '' } })).toThrowError(
      expect.objectContaining({ status: 400, code: 'VALIDATION', message: 'Validation failed', details: expect.any(Array) }),
    );
  });

  it('rejects an empty update object when the schema requires a change', () => {
    const schema = z.object({ name: z.string().optional() }).refine((value) => Object.keys(value).length > 0);
    expect(() => validateAndThrow({ schema, data: {} })).toThrowError(expect.objectContaining({ code: 'VALIDATION' }));
  });
});
