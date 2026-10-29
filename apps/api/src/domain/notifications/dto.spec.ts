import { describe, expect, it } from 'vitest';
import { listNotificationsQueryDto } from './dto.js';

describe('listNotificationsQueryDto', () => {
  it('defaults page=1, limit=20, sortBy=createdAt, sortDir=desc', () => {
    expect(listNotificationsQueryDto.parse({})).toEqual({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortDir: 'desc',
    });
  });

  it('accepts valid query params', () => {
    expect(
      listNotificationsQueryDto.parse({
        page: '2',
        limit: '10',
        unread: 'true',
        q: 'finished',
        sortBy: 'type',
        sortDir: 'asc',
      }),
    ).toEqual({
      page: 2,
      limit: 10,
      unread: 'true',
      q: 'finished',
      sortBy: 'type',
      sortDir: 'asc',
    });
  });
});
