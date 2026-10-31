import crypto from 'node:crypto';
import type { ErrorLogEntry, ErrorLogSink } from '../../domain/error-reporting/interface.js';
import type { StorageInterface } from '../../domain/storage/interface.js';
import { redactEntry } from './redaction.js';

export type ErrorLogSinkOptions = {
  storage: StorageInterface;
  now?: () => Date;
  flushIntervalMs?: number;
  maxBufferEntries?: number;
  maxBatchBytes?: number;
  idFactory?: () => string;
};

function formatKey(date: Date, id: string): string {
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');

  return `logs/errors/${yyyy}/${mm}/${dd}/${hh}${min}${ss}-${id}.jsonl`;
}

export function buildErrorLogSink({
  storage,
  now = () => new Date(),
  flushIntervalMs = 10_000,
  maxBufferEntries = 500,
  maxBatchBytes,
  idFactory = () => crypto.randomBytes(6).toString('hex'),
}: ErrorLogSinkOptions): ErrorLogSink {
  let buffer: ErrorLogEntry[] = [];
  let droppedCount = 0;
  let timer: NodeJS.Timeout | null = null;
  let isFlushing = false;

  const flush = async (): Promise<void> => {
    if (isFlushing || (buffer.length === 0 && droppedCount === 0)) {
      return;
    }

    isFlushing = true;
    try {
      const itemsToFlush: ErrorLogEntry[] = [];

      if (droppedCount > 0) {
        itemsToFlush.push({
          time: now().toISOString(),
          level: 'warn',
          message: 'error log entries dropped',
          fingerprint: 'dropped-entries',
          context: { droppedCount },
        });
      }

      itemsToFlush.push(...buffer);

      // Encode JSON lines
      const lines = itemsToFlush.map((item) => JSON.stringify(item)).join('\n') + '\n';
      const body = Buffer.from(lines, 'utf8');

      if (maxBatchBytes && body.length > maxBatchBytes) {
        // If maxBatchBytes is enforced and buffer exceeds it, we can split or write what fits
        // (Default leaves maxBatchBytes optional)
      }

      const timestamp = now();
      const id = idFactory();
      const key = formatKey(timestamp, id);

      await storage.putObject({
        key,
        body,
        contentType: 'application/x-ndjson',
      });

      // Clear successfully flushed batch
      buffer = buffer.slice(itemsToFlush.length - (droppedCount > 0 ? 1 : 0));
      droppedCount = 0;
    } catch {
      // Flush failure must never throw: keep buffer and retry on next flush
    } finally {
      isFlushing = false;
    }
  };

  return {
    record(rawEntry: ErrorLogEntry): void {
      const entry = redactEntry(rawEntry);

      // Fallback console output so nothing is silently lost
      try {
        console.error(JSON.stringify(entry));
      } catch {
        // Ignore serialization issues on console fallback
      }

      // Check buffer bounds
      if (buffer.length >= maxBufferEntries) {
        // Drop oldest entries
        const excess = buffer.length - maxBufferEntries + 1;
        buffer.splice(0, excess);
        droppedCount += excess;
      }

      buffer.push(entry);
    },

    flush,

    start(): void {
      if (!timer) {
        timer = setInterval(() => {
          void flush();
        }, flushIntervalMs);
        timer.unref?.();
      }
    },

    async stop(): Promise<void> {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      await flush();
    },
  };
}
