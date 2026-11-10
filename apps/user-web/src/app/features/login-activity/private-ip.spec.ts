import { describe, expect, it } from 'vitest';
import { isPrivateIpAddress } from '@slipakar/ui/private-ip';

describe('isPrivateIpAddress', () => {
  it.each([
    '10.0.0.8',
    '172.16.0.1',
    '172.31.255.254',
    '192.168.10.20',
    '127.0.0.1',
    '::1',
    'fc00::1',
    'fd12:3456::1',
  ])('recognizes %s as a private or loopback address', (ip) => {
    expect(isPrivateIpAddress(ip)).toBe(true);
  });

  it.each(['172.15.255.255', '172.32.0.1', '8.8.8.8', '2001:4860:4860::8888', null])(
    'does not classify %s as private',
    (ip) => expect(isPrivateIpAddress(ip)).toBe(false),
  );
});
