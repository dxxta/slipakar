import { describe, expect, it } from 'vitest';
import { listProjectsQueryDto } from './dto.js';

describe('listProjectsQueryDto', () => {
  it('defaults page=1, limit=20, sortBy=createdAt, sortDir=desc', () => {
    const parsed = listProjectsQueryDto.parse({});
    expect(parsed).toEqual({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortDir: 'desc',
    });
  });

  it('accepts valid query params', () => {
    const parsed = listProjectsQueryDto.parse({
      page: '2',
      limit: '50',
      q: 'my-project',
      sortBy: 'name',
      sortDir: 'asc',
    });
    expect(parsed).toEqual({
      page: 2,
      limit: 50,
      q: 'my-project',
      sortBy: 'name',
      sortDir: 'asc',
    });
  });

  it('rejects invalid sortBy', () => {
    const res = listProjectsQueryDto.safeParse({ sortBy: 'invalid' });
    expect(res.success).toBe(false);
  });

  it('rejects invalid limit', () => {
    expect(listProjectsQueryDto.safeParse({ limit: 0 }).success).toBe(false);
    expect(listProjectsQueryDto.safeParse({ limit: 101 }).success).toBe(false);
  });
});
