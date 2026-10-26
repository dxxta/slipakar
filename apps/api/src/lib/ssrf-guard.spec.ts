import { describe, expect, it } from 'vitest';
import { isBlockedSsrfTarget, validateIntegrationUrl } from './ssrf-guard.js';

describe('ssrf-guard', () => {
  it('blocks IPv4 link-local and cloud metadata addresses (169.254.0.0/16)', () => {
    expect(isBlockedSsrfTarget('169.254.169.254')).toBe(true);
    expect(isBlockedSsrfTarget('169.254.0.1')).toBe(true);
  });

  it('blocks IPv6 link-local addresses (fe80::/10)', () => {
    expect(isBlockedSsrfTarget('fe80::1')).toBe(true);
    expect(isBlockedSsrfTarget('[fe80::1]')).toBe(true);
  });

  it('allows normal domain names and internal docker / private hostnames', () => {
    expect(isBlockedSsrfTarget('uptime-kuma')).toBe(false);
    expect(isBlockedSsrfTarget('grafana')).toBe(false);
    expect(isBlockedSsrfTarget('localhost')).toBe(false);
    expect(isBlockedSsrfTarget('127.0.0.1')).toBe(false);
    expect(isBlockedSsrfTarget('172.18.0.2')).toBe(false);
    expect(isBlockedSsrfTarget('10.0.0.5')).toBe(false);
    expect(isBlockedSsrfTarget('example.com')).toBe(false);
  });

  it('validateIntegrationUrl permits valid internal/external http/https URLs', () => {
    const u1 = validateIntegrationUrl('http://uptime-kuma:3001');
    expect(u1.origin).toBe('http://uptime-kuma:3001');

    const u2 = validateIntegrationUrl('https://grafana.internal.net:3000/path');
    expect(u2.hostname).toBe('grafana.internal.net');
  });

  it('validateIntegrationUrl rejects non-http schemes, credentials in URL, and metadata IPs', () => {
    expect(() => validateIntegrationUrl('ftp://example.com')).toThrow(/HTTP and HTTPS/);
    expect(() => validateIntegrationUrl('file:///etc/passwd')).toThrow(/HTTP and HTTPS/);
    expect(() => validateIntegrationUrl('http://admin:secret@grafana:3000')).toThrow(/Credentials are not allowed/);
    expect(() => validateIntegrationUrl('http://169.254.169.254/latest/meta-data')).toThrow(/metadata addresses is forbidden/);
    expect(() => validateIntegrationUrl('http://[fe80::1]:3000')).toThrow(/metadata addresses is forbidden/);
    expect(() => validateIntegrationUrl('not-a-url')).toThrow(/Invalid URL format/);
  });
});
