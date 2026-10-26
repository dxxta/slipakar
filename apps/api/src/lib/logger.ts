import pino, { type Logger } from 'pino';
import type { Writable } from 'node:stream';

const redact = {
  paths: ['password', 'secret', 'accessKey', 'smtpPassword', '*.password'],
  censor: '[Redacted]',
};

export function createLogger(stream?: Writable): Logger {
  return pino({ redact }, stream);
}

export const logger = createLogger();
