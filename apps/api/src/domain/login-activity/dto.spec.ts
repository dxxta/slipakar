import { describe, expect, it } from 'vitest';
import {
  listLoginActivityQueryDto,
  listAdminLoginActivityQueryDto,
  loginEventViewDto,
} from './dto.js';

describe('Login Activity DTO', () => {
  it('validates user list query defaults', () => {
    const parsed = listLoginActivityQueryDto.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
    expect(parsed.sortBy).toBe('createdAt');
    expect(parsed.sortDir).toBe('desc');
  });

  it('validates allowed user sortBy values', () => {
    expect(() =>
      listLoginActivityQueryDto.parse({
        sortBy: 'userEmail', // Not allowed on user query
      }),
    ).toThrow();

    const valid = listLoginActivityQueryDto.parse({
      sortBy: 'country',
      sortDir: 'asc',
      q: 'Chrome',
    });
    expect(valid.sortBy).toBe('country');
  });

  it('validates admin list query with userEmail sortBy', () => {
    const parsed = listAdminLoginActivityQueryDto.parse({
      sortBy: 'userEmail',
      q: 'admin@example.com',
    });
    expect(parsed.sortBy).toBe('userEmail');
    expect(parsed.q).toBe('admin@example.com');
  });

  it('validates LoginEventView format', () => {
    const view = loginEventViewDto.parse({
      id: 'event-1',
      userId: 'user-1',
      ip: '8.8.8.8',
      proxy: false,
      browser: 'Chrome',
      os: 'macOS',
      deviceType: 'desktop',
      country: 'US',
      region: 'CA',
      city: 'Mountain View',
      latitude: 37.422,
      longitude: -122.084,
      createdAt: new Date().toISOString(),
    });
    expect(view.ip).toBe('8.8.8.8');
  });
});
