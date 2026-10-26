import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createLogger } from './logger.js';

describe('logger', () => {
  it('redacts sensitive fields, including nested passwords', () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const logger = createLogger(stream);
    logger.info({ password: 'top-secret', secret: 'hidden', accessKey: 'key', smtpPassword: 'smtp', account: { password: 'nested' } }, 'test');
    const entry = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(entry.password).toBe('[Redacted]');
    expect(entry.secret).toBe('[Redacted]');
    expect(entry.accessKey).toBe('[Redacted]');
    expect(entry.smtpPassword).toBe('[Redacted]');
    expect(entry.account).toEqual({ password: '[Redacted]' });
  });
});
