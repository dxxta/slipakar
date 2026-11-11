import { describe, expect, it } from 'vitest';
import {
  listAdminUsersQueryDto,
  updateAdminUserDto,
  disableUserDto,
  adminUserViewSchema,
} from './dto.js';

describe('Admin Users DTOs', () => {
  it('parses listAdminUsersQueryDto with defaults', () => {
    const parsed = listAdminUsersQueryDto.parse({});
    expect(parsed).toEqual({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortDir: 'desc',
    });
  });

  it('rejects invalid sortBy in listAdminUsersQueryDto', () => {
    expect(() => listAdminUsersQueryDto.parse({ sortBy: 'unknown' })).toThrow();
  });

  it('validates updateAdminUserDto rejecting empty object and unknown fields (email)', () => {
    expect(() => updateAdminUserDto.parse({})).toThrow();
    expect(() => updateAdminUserDto.parse({ email: 'new@example.com' })).toThrow();
    expect(updateAdminUserDto.parse({ name: 'New Name' })).toEqual({ name: 'New Name' });
    expect(updateAdminUserDto.parse({ image: null })).toEqual({ image: null });
  });

  it('validates disableUserDto', () => {
    expect(disableUserDto.parse({})).toEqual({});
    expect(disableUserDto.parse({ reason: 'Suspicious activity' })).toEqual({ reason: 'Suspicious activity' });
    expect(() => disableUserDto.parse({ extra: 'field' })).toThrow();
  });

  it('validates adminUserViewSchema', () => {
    const valid = {
      id: 'usr-1',
      email: 'user@example.com',
      name: 'Alice',
      image: null,
      role: 'admin',
      emailVerified: true,
      createdAt: new Date().toISOString(),
      disabledAt: null,
    };
    expect(adminUserViewSchema.parse(valid)).toEqual(valid);
  });
});
