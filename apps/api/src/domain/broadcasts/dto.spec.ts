import { describe, expect, it } from 'vitest';
import {
  createBroadcastDto,
  updateBroadcastDto,
  maskEmail,
} from './dto.js';

describe('Broadcast DTO', () => {
  it('validates createBroadcastDto with default audience all', () => {
    const valid = createBroadcastDto.parse({
      subject: 'System Maintenance',
      bodyText: 'We will have maintenance tonight.',
    });
    expect(valid.audience).toBe('all');
    expect(valid.subject).toBe('System Maintenance');
  });

  it('validates audience with role or users filter', () => {
    const valid = createBroadcastDto.parse({
      subject: 'Admin Notice',
      bodyText: 'Notice for admins.',
      audience: 'role',
      audienceFilter: { role: 'admin' },
    });
    expect(valid.audience).toBe('role');
    expect(valid.audienceFilter).toEqual({ role: 'admin' });
  });

  it('rejects audience role when audienceFilter.role is missing or empty', () => {
    expect(() =>
      createBroadcastDto.parse({
        subject: 'Role Notice',
        bodyText: 'Body',
        audience: 'role',
      }),
    ).toThrow();

    expect(() =>
      createBroadcastDto.parse({
        subject: 'Role Notice',
        bodyText: 'Body',
        audience: 'role',
        audienceFilter: { role: '   ' },
      }),
    ).toThrow();
  });

  it('rejects audience users when audienceFilter.userIds is missing or empty', () => {
    expect(() =>
      createBroadcastDto.parse({
        subject: 'User Notice',
        bodyText: 'Body',
        audience: 'users',
      }),
    ).toThrow();

    expect(() =>
      createBroadcastDto.parse({
        subject: 'User Notice',
        bodyText: 'Body',
        audience: 'users',
        audienceFilter: { userIds: [] },
      }),
    ).toThrow();
  });

  it('allows optional audienceFilter when audience is all', () => {
    const result = createBroadcastDto.parse({
      subject: 'All Notice',
      bodyText: 'Body',
      audience: 'all',
      audienceFilter: { role: 'admin' },
    });
    expect(result.audience).toBe('all');
  });

  it('validates updateBroadcastDto (at least one field)', () => {
    const valid = updateBroadcastDto.parse({
      subject: 'Updated Subject',
    });
    expect(valid.subject).toBe('Updated Subject');
    expect(() => updateBroadcastDto.parse({})).toThrow();
  });

  it('masks emails properly', () => {
    expect(maskEmail('alice@example.com')).toBe('a***e@example.com');
    expect(maskEmail('me@example.com')).toBe('m*e@example.com');
    expect(maskEmail('a@b.com')).toBe('a***@b.com');
  });
});
