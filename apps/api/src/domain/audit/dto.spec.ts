import { describe, expect, it } from 'vitest';
import { listActivityQueryDto } from './dto.js';

describe('listActivityQueryDto', () => {
  it('defaults page=1, limit=20', () => {
    expect(listActivityQueryDto.parse({})).toEqual({
      page: 1,
      limit: 20,
    });
  });

  it('accepts valid page and limit', () => {
    expect(listActivityQueryDto.parse({ page: '5', limit: '50' })).toEqual({
      page: 5,
      limit: 50,
    });
  });
});
