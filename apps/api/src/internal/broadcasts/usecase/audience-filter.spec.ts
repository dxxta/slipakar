import { describe, expect, it } from 'vitest';
import { validateAudienceFilter } from './broadcasts.js';

describe('validateAudienceFilter', () => {
  it('passes for audience all', () => {
    expect(() => validateAudienceFilter('all', null)).not.toThrow();
    expect(() => validateAudienceFilter('all', { something: 123 })).not.toThrow();
  });

  it('validates audience role', () => {
    expect(() => validateAudienceFilter('role', { role: 'admin' })).not.toThrow();
    expect(() => validateAudienceFilter('role', null)).toThrow();
    expect(() => validateAudienceFilter('role', {})).toThrow();
    expect(() => validateAudienceFilter('role', { role: '   ' })).toThrow();
  });

  it('validates audience users', () => {
    expect(() => validateAudienceFilter('users', { userIds: ['u-1', 'u-2'] })).not.toThrow();
    expect(() => validateAudienceFilter('users', null)).toThrow();
    expect(() => validateAudienceFilter('users', {})).toThrow();
    expect(() => validateAudienceFilter('users', { userIds: [] })).toThrow();
    expect(() => validateAudienceFilter('users', { userIds: ['   '] })).toThrow();
  });
});
