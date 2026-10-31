import type { ErrorLogEntry } from '../../domain/error-reporting/interface.js';

const SENSITIVE_KEY_REGEX = /pass|secret|token|authorization|cookie|api[-_]?key|dsn/i;
const EXCLUDED_BODY_KEY_REGEX = /^(request_?body|email_?body|body)$/i;

const MAX_STRING_LENGTH = 2000;
const MAX_STACK_LENGTH = 4000;

export function redactData(value: unknown, seen = new WeakSet()): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH ? value.slice(0, MAX_STRING_LENGTH) : value;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactData(item, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    // Strip request or email bodies completely
    if (EXCLUDED_BODY_KEY_REGEX.test(key)) {
      continue;
    }

    if (SENSITIVE_KEY_REGEX.test(key)) {
      result[key] = '[redacted]';
    } else {
      result[key] = redactData(val, seen);
    }
  }

  return result;
}

export function redactEntry(entry: ErrorLogEntry): ErrorLogEntry {
  const truncatedMessage =
    entry.message.length > MAX_STRING_LENGTH
      ? entry.message.slice(0, MAX_STRING_LENGTH)
      : entry.message;

  const truncatedStack =
    typeof entry.stack === 'string'
      ? entry.stack.length > MAX_STACK_LENGTH
        ? entry.stack.slice(0, MAX_STACK_LENGTH)
        : entry.stack
      : undefined;

  const redactedContext = entry.context
    ? (redactData(entry.context) as Record<string, unknown>)
    : undefined;

  return {
    ...entry,
    message: truncatedMessage,
    stack: truncatedStack,
    context: redactedContext,
  };
}
