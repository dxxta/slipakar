import { describe, expect, it } from 'vitest';
import { listSmtpQueryDto } from './dto.js';

describe('listSmtpQueryDto', () => {
  it('defaults page=1, limit=20, sortBy=createdAt, sortDir=desc', () => {
    const parsed = listSmtpQueryDto.parse({});
    expect(parsed).toEqual({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortDir: 'desc',
    });
  });

  it('accepts valid query params', () => {
    const parsed = listSmtpQueryDto.parse({
      page: '1',
      limit: '10',
      q: 'smtp.mailgun.org',
      sortBy: 'host',
      sortDir: 'asc',
    });
    expect(parsed).toEqual({
      page: 1,
      limit: 10,
      q: 'smtp.mailgun.org',
      sortBy: 'host',
      sortDir: 'asc',
    });
  });
});
