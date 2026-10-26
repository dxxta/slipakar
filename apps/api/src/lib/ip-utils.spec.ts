import { describe, expect, it } from 'vitest';
import { isPrivateIp, resolveProxyFlag } from './ip-utils.js';

describe('ip-utils', () => {
  it('detects private IPv4 addresses', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('192.168.1.1')).toBe(true);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
  });

  it('detects private IPv6 addresses', () => {
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('fe80::1')).toBe(true);
    expect(isPrivateIp('fc00::1')).toBe(true);
  });

  it('resolves proxy flag as best effort', () => {
    // Single hop external IP -> false
    expect(resolveProxyFlag({ ip: '8.8.8.8', forwardedFor: '8.8.8.8' })).toBe(false);
    // Multiple hops in X-Forwarded-For with public IP -> true
    expect(resolveProxyFlag({ ip: '8.8.8.8', forwardedFor: '8.8.8.8, 1.1.1.1' })).toBe(true);
    // Multiple hops array with public IP -> true
    expect(resolveProxyFlag({ ip: '8.8.8.8', forwardedFor: ['8.8.8.8', '1.1.1.1'] })).toBe(true);
    // Private / loopback / docker IP -> false (never proxy: true)
    expect(resolveProxyFlag({ ip: '127.0.0.1', forwardedFor: undefined })).toBe(false);
    expect(resolveProxyFlag({ ip: '172.18.0.1', forwardedFor: undefined })).toBe(false);
    expect(resolveProxyFlag({ ip: '10.0.0.1', forwardedFor: '10.0.0.1, 10.0.0.2' })).toBe(false);
    // Null or undefined IP -> false
    expect(resolveProxyFlag({ ip: null })).toBe(false);
    expect(resolveProxyFlag({ ip: undefined })).toBe(false);
  });
});
