import crypto from 'node:crypto';
import type {
  ErrorLogEntry,
  ErrorLogSink,
  ErrorReporter,
  SentryClient,
} from '../../domain/error-reporting/interface.js';

export type ErrorReporterOptions = {
  sink: ErrorLogSink;
  sentry?: SentryClient;
  now?: () => Date;
  breakerCooldownMs?: number;
  dedupeWindowMs?: number;
};

export function computeFingerprint(error: unknown): string {
  let name = 'Error';
  let firstLineMessage = '';
  let firstStackFrame = '';

  if (error instanceof Error) {
    name = error.name || 'Error';
    firstLineMessage = (error.message || '').split('\n')[0] || '';
    if (error.stack) {
      const frames = error.stack.split('\n').map((l) => l.trim());
      // First frame that starts with 'at '
      firstStackFrame = frames.find((f) => f.startsWith('at ')) || '';
    }
  } else if (typeof error === 'string') {
    firstLineMessage = error.split('\n')[0] || '';
  } else if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    name = typeof obj.name === 'string' ? obj.name : 'Object';
    firstLineMessage = typeof obj.message === 'string' ? obj.message.split('\n')[0] || '' : '';
  } else {
    firstLineMessage = String(error);
  }

  const raw = `${name}:${firstLineMessage}:${firstStackFrame}`;
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 16);
}

function isRateLimitOrQuotaError(error: unknown): boolean {
  if (!error) return false;
  const status = (error as { status?: number }).status;
  if (status === 429) return true;

  const msg = error instanceof Error ? error.message : String(error);
  return /rate limit|quota/i.test(msg);
}

export function buildErrorReporter({
  sink,
  sentry,
  now = () => new Date(),
  breakerCooldownMs = 300_000,
  dedupeWindowMs = 60_000,
}: ErrorReporterOptions): ErrorReporter {
  // Circuit breaker state: 'closed' | 'open' | 'half_open'
  let breakerState: 'closed' | 'open' | 'half_open' = 'closed';
  let breakerOpenedAt = 0;

  // Deduplication state: fingerprint -> { lastSentMs: number, count: number }
  const dedupeMap = new Map<string, { lastSentMs: number; count: number }>();

  const forwardToSentry = async (entry: ErrorLogEntry): Promise<void> => {
    if (!sentry) return;

    const currentMs = now().getTime();

    // Check circuit breaker status
    if (breakerState === 'open') {
      if (currentMs - breakerOpenedAt >= breakerCooldownMs) {
        // Cooldown passed: transition to half-open and attempt one probe
        breakerState = 'half_open';
      } else {
        return;
      }
    }

    try {
      await sentry.capture(entry);
      // On success in half-open or closed:
      breakerState = 'closed';
    } catch (err: unknown) {
      // Rejection or 429 / quota error -> open breaker
      if (isRateLimitOrQuotaError(err)) {
        breakerState = 'open';
        breakerOpenedAt = now().getTime();
      } else {
        breakerState = 'open';
        breakerOpenedAt = now().getTime();
      }
    }
  };

  return {
    capture(error: unknown, context?: Record<string, unknown>): void {
      try {
        const currentTime = now();
        const currentMs = currentTime.getTime();
        const fingerprint = computeFingerprint(error);

        // Deduplication tracking
        const dedupeRecord = dedupeMap.get(fingerprint);
        let count = 1;
        let shouldForwardSentry = true;

        if (dedupeRecord) {
          if (currentMs - dedupeRecord.lastSentMs < dedupeWindowMs) {
            dedupeRecord.count += 1;
            count = dedupeRecord.count;
            shouldForwardSentry = false; // Dedupe window: forward once to Sentry
          } else {
            // Window expired, reset
            dedupeRecord.lastSentMs = currentMs;
            dedupeRecord.count = 1;
          }
        } else {
          dedupeMap.set(fingerprint, { lastSentMs: currentMs, count: 1 });
        }

        const message =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : 'Unknown error';

        const name =
          error instanceof Error
            ? error.name
            : typeof error === 'object' && error && 'name' in error
              ? String((error as { name: unknown }).name)
              : undefined;

        const stack = error instanceof Error ? error.stack : undefined;

        const entry: ErrorLogEntry = {
          time: currentTime.toISOString(),
          level: 'error',
          message,
          name,
          stack,
          context,
          fingerprint,
          count: count > 1 ? count : undefined,
        };

        // 1. ALWAYS record to sink first
        try {
          sink.record(entry);
        } catch {
          // Sink error must never bubble out
        }

        // 2. Forward to sentry fire and forget
        if (sentry && shouldForwardSentry) {
          void forwardToSentry(entry);
        }
      } catch {
        // Never throw out of capture
      }
    },
  };
}
