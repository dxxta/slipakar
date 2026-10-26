import { describe, expectTypeOf, it } from 'vitest';
import type { PageMetadata, RepositoryResponse, ResponseTypeWithoutMetadata, ResponseTypeWithMetadata } from './types.js';

describe('shared response types', () => {
  it('has the requested page metadata fields', () => {
    expectTypeOf<PageMetadata>().toEqualTypeOf<{ page: number; limit: number; total: number }>();
  });

  it('wraps repository data with optional metadata', () => {
    expectTypeOf<RepositoryResponse<string>>().toEqualTypeOf<{ data: string; metadata?: PageMetadata }>();
  });

  it('has response envelopes with and without metadata', () => {
    expectTypeOf<ResponseTypeWithoutMetadata<string>>().toEqualTypeOf<{ message: string; data: string; success: true }>();
    expectTypeOf<ResponseTypeWithMetadata<string>>().toExtend<{ message: string; data: string; success: true; metadata: PageMetadata }>();
  });
});
