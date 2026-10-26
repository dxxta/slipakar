import { describe, expect, it } from 'vitest';
import { parseUserAgent } from './user-agent-parser.js';

describe('parseUserAgent', () => {
  it('parses Chrome on macOS', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const parsed = parseUserAgent(ua);
    expect(parsed.browser).toBe('Chrome');
    expect(parsed.os).toBe('macOS');
    expect(parsed.deviceType).toBe('desktop');
  });

  it('parses Safari on iPhone (mobile)', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const parsed = parseUserAgent(ua);
    expect(parsed.browser).toBe('Safari');
    expect(parsed.os).toBe('iOS');
    expect(parsed.deviceType).toBe('mobile');
  });

  it('parses Firefox on Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0';
    const parsed = parseUserAgent(ua);
    expect(parsed.browser).toBe('Firefox');
    expect(parsed.os).toBe('Windows');
    expect(parsed.deviceType).toBe('desktop');
  });

  it('parses iPad (tablet)', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';
    const parsed = parseUserAgent(ua);
    expect(parsed.os).toBe('iOS');
    expect(parsed.deviceType).toBe('tablet');
  });

  it('handles null or empty UA gracefully', () => {
    const parsed = parseUserAgent(null);
    expect(parsed.browser).toBeNull();
    expect(parsed.os).toBeNull();
    expect(parsed.deviceType).toBeNull();
  });
});
