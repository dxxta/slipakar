import { describe, expect, it } from 'vitest';
import { listTemplatesQueryDto } from './dto.js';

describe('listTemplatesQueryDto', () => {
  it('defaults page=1, limit=20, sortBy=createdAt, sortDir=desc', () => {
    const parsed = listTemplatesQueryDto.parse({});
    expect(parsed).toEqual({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortDir: 'desc',
    });
  });

  it('accepts valid query params', () => {
    const parsed = listTemplatesQueryDto.parse({
      page: '3',
      limit: '15',
      q: 'invoice',
      sortBy: 'name',
      sortDir: 'asc',
    });
    expect(parsed).toEqual({
      page: 3,
      limit: 15,
      q: 'invoice',
      sortBy: 'name',
      sortDir: 'asc',
    });
  });
});
