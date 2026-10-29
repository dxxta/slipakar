import { describe, expect, it } from 'vitest';
import { listCampaignsQueryDto, listRecipientsQueryDto } from './dto.js';

describe('campaigns DTO query validation', () => {
  it('validates listCampaignsQueryDto defaults and inputs', () => {
    expect(listCampaignsQueryDto.parse({})).toEqual({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortDir: 'desc',
    });
    expect(
      listCampaignsQueryDto.parse({
        page: '2',
        limit: '10',
        q: 'payroll',
        sortBy: 'status',
        sortDir: 'asc',
      }),
    ).toEqual({
      page: 2,
      limit: 10,
      q: 'payroll',
      sortBy: 'status',
      sortDir: 'asc',
    });
  });

  it('validates listRecipientsQueryDto defaults and inputs', () => {
    expect(listRecipientsQueryDto.parse({})).toEqual({
      page: 1,
      limit: 20,
      sortBy: 'rowIndex',
      sortDir: 'asc',
    });
    expect(
      listRecipientsQueryDto.parse({
        status: 'failed',
        page: '3',
        limit: '15',
        q: 'alice@example.com',
        sortBy: 'email',
        sortDir: 'desc',
      }),
    ).toEqual({
      status: 'failed',
      page: 3,
      limit: 15,
      q: 'alice@example.com',
      sortBy: 'email',
      sortDir: 'desc',
    });
  });
});
