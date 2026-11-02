import { describe, expect, it } from 'vitest';
import { listQueryString } from './list-query';

describe('listQueryString', () => {
  it('serializes pagination and sort values and trims the optional search', () => {
    expect(listQueryString({ page: 2, limit: 25, q: ' Payroll ', sortBy: 'name', sortDir: 'asc' }))
      .toBe('?page=2&limit=25&sortBy=name&sortDir=asc&q=Payroll');
  });

  it('omits a blank search term', () => {
    expect(listQueryString({ page: 1, limit: 20, q: '  ', sortBy: 'createdAt', sortDir: 'desc' }))
      .toBe('?page=1&limit=20&sortBy=createdAt&sortDir=desc');
  });
});
