import { describe, expect, it, vi } from 'vitest';
import type { ErrorLogEntry } from '../../../domain/error-reporting/interface.js';
import type { StorageInterface } from '../../../domain/storage/interface.js';
import { redactData, redactEntry } from './redaction.js';
import { buildErrorLogSink } from './sink.js';
import { buildErrorReporter, computeFingerprint } from './reporter.js';

describe('Redaction', () => {
  it('deep-redacts keys matching pattern and truncates long strings', () => {
    const raw = {
      user: 'alice',
      password: 'my-secret-password',
      nested: {
        authToken: 'xyz123',
        secret_key: 'supersecret',
        cookie: 'session=123',
        apiKey: 'key-abc',
        api_key: 'key-xyz',
        dsn: 'https://user@sentry.io/1',
        safe: 'normal value',
        array: [
          { token: 'arr-token', note: 'safe note' },
          'just string',
        ],
      },
      longString: 'a'.repeat(3000),
      requestBody: { body: 'should be excluded if handled or redacted' },
    };

    const redacted = redactData(raw) as Record<string, unknown>;

    expect(redacted.user).toBe('alice');
    expect(redacted.password).toBe('[redacted]');
    const nested = redacted.nested as Record<string, unknown>;
    expect(nested.authToken).toBe('[redacted]');
    expect(nested.secret_key).toBe('[redacted]');
    expect(nested.cookie).toBe('[redacted]');
    expect(nested.apiKey).toBe('[redacted]');
    expect(nested.api_key).toBe('[redacted]');
    expect(nested.dsn).toBe('[redacted]');
    expect(nested.safe).toBe('normal value');

    const arr = nested.array as Array<Record<string, unknown> | string>;
    expect((arr[0] as Record<string, unknown>).token).toBe('[redacted]');
    expect((arr[0] as Record<string, unknown>).note).toBe('safe note');

    expect(typeof redacted.longString).toBe('string');
    expect((redacted.longString as string).length).toBe(2000);
  });

  it('redacts ErrorLogEntry and truncates stack to 4000 chars', () => {
    const entry: ErrorLogEntry = {
      time: '2026-11-08T12:00:00.000Z',
      level: 'error',
      message: 'Failed to connect: secret-token in message ' + 'x'.repeat(2500),
      name: 'AuthError',
      stack: 'Error: boom\n' + 'stack line\n'.repeat(500),
      context: {
        authorization: 'Bearer 12345',
        details: 'regular details',
      },
      fingerprint: 'abc1234567890def',
    };

    const cleaned = redactEntry(entry);
    expect(cleaned.message.length).toBeLessThanOrEqual(2000);
    expect(cleaned.stack!.length).toBeLessThanOrEqual(4000);
    expect(cleaned.context!.authorization).toBe('[redacted]');
    expect(cleaned.context!.details).toBe('regular details');
  });

  it('strips request or email bodies from context', () => {
    const entry: ErrorLogEntry = {
      time: '2026-11-08T12:00:00.000Z',
      level: 'error',
      message: 'Error with body context',
      fingerprint: '1234567890abcdef',
      context: {
        requestBody: { some: 'data' },
        request_body: 'raw body',
        emailBody: '<html>Secret email content</html>',
        body: 'generic body',
        safeParam: 42,
      },
    };

    const cleaned = redactEntry(entry);
    expect(cleaned.context!.requestBody).toBeUndefined();
    expect(cleaned.context!.request_body).toBeUndefined();
    expect(cleaned.context!.emailBody).toBeUndefined();
    expect(cleaned.context!.body).toBeUndefined();
    expect(cleaned.context!.safeParam).toBe(42);
  });
});

describe('ErrorLogSink', () => {
  it('writes JSON Lines to storage with formatted key logs/errors/YYYY/MM/DD/HHmmss-id.jsonl', async () => {
    const uploaded: Array<{ key: string; body: Buffer; contentType: string }> = [];
    const storage: StorageInterface = {
      ensureBucket: vi.fn().mockResolvedValue(undefined),
      putObject: vi.fn().mockImplementation(async (input) => {
        uploaded.push(input);
      }),
      getObject: vi.fn(),
      deleteObject: vi.fn(),
      objectExists: vi.fn(),
    };

    const fixedDate = new Date('2026-11-08T14:35:20.123Z');
    const sink = buildErrorLogSink({
      storage,
      now: () => fixedDate,
      idFactory: () => 'fixedid',
    });

    const entry: ErrorLogEntry = {
      time: fixedDate.toISOString(),
      level: 'error',
      message: 'Database error',
      fingerprint: 'abc1234567890def',
    };

    sink.record(entry);
    await sink.flush();

    expect(uploaded).toHaveLength(1);
    expect(uploaded[0].key).toBe('logs/errors/2026/11/08/143520-fixedid.jsonl');
    expect(uploaded[0].contentType).toBe('application/x-ndjson');

    const lines = uploaded[0].body.toString('utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.message).toBe('Database error');
    expect(parsed.fingerprint).toBe('abc1234567890def');
  });

  it('outputs compact JSON line to console.error as fallback on every record', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const storage: StorageInterface = {
      ensureBucket: vi.fn().mockResolvedValue(undefined),
      putObject: vi.fn().mockResolvedValue(undefined),
      getObject: vi.fn(),
      deleteObject: vi.fn(),
      objectExists: vi.fn(),
    };

    const sink = buildErrorLogSink({ storage });
    const entry: ErrorLogEntry = {
      time: '2026-11-08T12:00:00.000Z',
      level: 'error',
      message: 'Console fallback check',
      fingerprint: 'abcdef1234567890',
    };

    sink.record(entry);
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logged.message).toBe('Console fallback check');
    expect(logged.fingerprint).toBe('abcdef1234567890');

    consoleSpy.mockRestore();
  });

  it('drops oldest entries when buffer exceeds maxBufferEntries and logs dropped count in next batch', async () => {
    const uploaded: Array<{ key: string; body: Buffer; contentType: string }> = [];
    const storage: StorageInterface = {
      ensureBucket: vi.fn().mockResolvedValue(undefined),
      putObject: vi.fn().mockImplementation(async (input) => {
        uploaded.push(input);
      }),
      getObject: vi.fn(),
      deleteObject: vi.fn(),
      objectExists: vi.fn(),
    };

    const sink = buildErrorLogSink({
      storage,
      maxBufferEntries: 3,
    });

    sink.record({ time: '1', level: 'error', message: 'msg 1', fingerprint: 'fp1' });
    sink.record({ time: '2', level: 'error', message: 'msg 2', fingerprint: 'fp2' });
    sink.record({ time: '3', level: 'error', message: 'msg 3', fingerprint: 'fp3' });
    // 4th and 5th should drop msg 1 and msg 2
    sink.record({ time: '4', level: 'error', message: 'msg 4', fingerprint: 'fp4' });
    sink.record({ time: '5', level: 'error', message: 'msg 5', fingerprint: 'fp5' });

    await sink.flush();

    expect(uploaded).toHaveLength(1);
    const lines = uploaded[0].body.toString('utf8').trim().split('\n');
    // First line should be the dropped entries notification
    expect(lines).toHaveLength(4); // 1 dropped log + msg 3 + msg 4 + msg 5
    const droppedEntry = JSON.parse(lines[0]);
    expect(droppedEntry.message).toBe('error log entries dropped');
    expect(droppedEntry.context.droppedCount).toBe(2);

    const m3 = JSON.parse(lines[1]);
    expect(m3.message).toBe('msg 3');
    const m4 = JSON.parse(lines[2]);
    expect(m4.message).toBe('msg 4');
    const m5 = JSON.parse(lines[3]);
    expect(m5.message).toBe('msg 5');
  });

  it('keeps entries in buffer on flush failure and retries on next flush without throwing', async () => {
    let failPut = true;
    const uploaded: Array<{ key: string; body: Buffer }> = [];
    const storage: StorageInterface = {
      ensureBucket: vi.fn().mockResolvedValue(undefined),
      putObject: vi.fn().mockImplementation(async (input) => {
        if (failPut) throw new Error('MinIO connection refused');
        uploaded.push(input);
      }),
      getObject: vi.fn(),
      deleteObject: vi.fn(),
      objectExists: vi.fn(),
    };

    const sink = buildErrorLogSink({ storage });
    sink.record({ time: '1', level: 'error', message: 'important error', fingerprint: 'fp1' });

    // Flush fails, must not throw
    await expect(sink.flush()).resolves.toBeUndefined();
    expect(uploaded).toHaveLength(0);

    // Now MinIO recovers
    failPut = false;
    await expect(sink.flush()).resolves.toBeUndefined();
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0].body.toString('utf8')).toContain('important error');
  });
});

describe('ErrorReporter', () => {
  it('computes stable 16-char hex fingerprint from name, first line of message, and first stack frame', () => {
    const err1 = new Error('Database connection failed\nDetails: socket closed');
    const fp1 = computeFingerprint(err1);
    expect(fp1).toMatch(/^[0-9a-f]{16}$/);

    const err2 = new Error('Database connection failed\nDifferent details: timeout');
    err2.stack = err1.stack; // Same first line and same stack
    const fp2 = computeFingerprint(err2);
    expect(fp2).toBe(fp1);

    const err3 = new Error('Another error entirely');
    const fp3 = computeFingerprint(err3);
    expect(fp3).not.toBe(fp1);
  });

  it('records to sink first and forwards to Sentry', () => {
    const sinkEntries: ErrorLogEntry[] = [];
    const sink = {
      record: vi.fn((e) => sinkEntries.push(e)),
      flush: vi.fn().mockResolvedValue(undefined),
      start: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    const sentryCaptured: ErrorLogEntry[] = [];
    const sentry = {
      capture: vi.fn(async (e) => {
        sentryCaptured.push(e);
      }),
    };

    const reporter = buildErrorReporter({ sink, sentry });
    reporter.capture(new Error('Sample test error'), { meta: 'val' });

    expect(sink.record).toHaveBeenCalledTimes(1);
    expect(sinkEntries[0].message).toBe('Sample test error');
    expect(sinkEntries[0].context!.meta).toBe('val');
    expect(sentry.capture).toHaveBeenCalledTimes(1);
    expect(sentryCaptured[0].fingerprint).toBe(sinkEntries[0].fingerprint);
  });

  it('deduplicates reports to Sentry within dedupeWindowMs while still writing all to sink', async () => {
    let nowMs = 10000;
    const sinkEntries: ErrorLogEntry[] = [];
    const sink = {
      record: vi.fn((e) => sinkEntries.push(e)),
      flush: vi.fn().mockResolvedValue(undefined),
      start: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    const sentryCaptured: ErrorLogEntry[] = [];
    const sentry = {
      capture: vi.fn(async (e) => {
        sentryCaptured.push(e);
      }),
    };

    const reporter = buildErrorReporter({
      sink,
      sentry,
      now: () => new Date(nowMs),
      dedupeWindowMs: 60_000,
    });

    const error = new Error('Recurring error');

    // First call: both sink and sentry
    reporter.capture(error);
    expect(sink.record).toHaveBeenCalledTimes(1);
    expect(sentry.capture).toHaveBeenCalledTimes(1);

    // Second call at +10s: sink called with count, sentry skipped
    nowMs += 10_000;
    reporter.capture(error);
    expect(sink.record).toHaveBeenCalledTimes(2);
    expect(sinkEntries[1].count).toBe(2);
    expect(sentry.capture).toHaveBeenCalledTimes(1);

    // Third call after dedupe window (+70s): sentry called again
    nowMs += 70_000;
    reporter.capture(error);
    expect(sink.record).toHaveBeenCalledTimes(3);
    expect(sentry.capture).toHaveBeenCalledTimes(2);
  });

  it('circuit breaker opens on Sentry rejection or 429 rate limit, skips during cooldown, and tests half-open recovery', async () => {
    let nowMs = 1000;
    const sink = {
      record: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
      start: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    let sentryFail = true;
    const sentry = {
      capture: vi.fn(async () => {
        if (sentryFail) {
          const err = new Error('Rate limit exceeded: 429 Too Many Requests');
          (err as unknown as { status: number }).status = 429;
          throw err;
        }
      }),
    };

    const reporter = buildErrorReporter({
      sink,
      sentry,
      now: () => new Date(nowMs),
      breakerCooldownMs: 50_000,
      dedupeWindowMs: 0, // disable dedupe to isolate breaker
    });

    // 1. Initial capture fails -> opens circuit breaker
    reporter.capture(new Error('First err'));
    await new Promise((r) => setTimeout(r, 10)); // allow async promise in fire-and-forget
    expect(sentry.capture).toHaveBeenCalledTimes(1);

    // 2. Immediate next capture while open -> skipped
    nowMs += 10_000;
    reporter.capture(new Error('Second err'));
    await new Promise((r) => setTimeout(r, 10));
    expect(sentry.capture).toHaveBeenCalledTimes(1); // not incremented

    // 3. Fast-forward past cooldown (half-open)
    nowMs += 45_000; // nowMs = 56000 (> 1000 + 50000)
    sentryFail = false; // sentry recovers
    reporter.capture(new Error('Third err'));
    await new Promise((r) => setTimeout(r, 10));
    expect(sentry.capture).toHaveBeenCalledTimes(2); // half-open probe succeeded!

    // 4. Circuit breaker should now be closed: next capture executes normally
    nowMs += 1000;
    reporter.capture(new Error('Fourth err'));
    await new Promise((r) => setTimeout(r, 10));
    expect(sentry.capture).toHaveBeenCalledTimes(3);
  });

  it('never throws out of capture even when sink and sentry both throw synchronously', () => {
    const sink = {
      record: vi.fn(() => {
        throw new Error('Sink synchronous explosion');
      }),
      flush: vi.fn().mockResolvedValue(undefined),
      start: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    const sentry = {
      capture: vi.fn(() => {
        throw new Error('Sentry synchronous explosion');
      }),
    };

    const reporter = buildErrorReporter({ sink, sentry });

    expect(() => {
      reporter.capture(new Error('Bomb'));
    }).not.toThrow();
  });
});
