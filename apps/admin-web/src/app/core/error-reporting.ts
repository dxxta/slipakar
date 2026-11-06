import { ErrorHandler, Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import * as Sentry from '@sentry/angular';
import { environment } from '../../environments/environment';
import { ApiError } from './api-error';

const SENSITIVE_KEY_REGEX = /pass|secret|token|authorization|cookie|api[-_]?key|dsn/i;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const NUMERIC_SEGMENT_REGEX = /\/\d+(?=\/|$)/g;

/**
 * Sanitizes URLs to route patterns (drops query string, replaces raw UUIDs/IDs).
 */
export function sanitizeUrlPattern(url: string): string {
  if (!url) return '';
  const withoutQuery = url.split('?')[0];
  return withoutQuery
    .replace(UUID_REGEX, ':id')
    .replace(NUMERIC_SEGMENT_REGEX, '/:id');
}

/**
 * Recursively redacts sensitive keys and masks emails in string values.
 */
function redactValue(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_KEY_REGEX.test(key)) {
    return '[Redacted]';
  }

  if (typeof value === 'string') {
    return value.replace(EMAIL_REGEX, '[email]');
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (value && typeof value === 'object') {
    const redactedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      redactedObj[k] = SENSITIVE_KEY_REGEX.test(k) ? '[Redacted]' : redactValue(v, k);
    }
    return redactedObj;
  }

  return value;
}

/**
 * Determines whether an error should be reported.
 * Skips expected client errors (HTTP status 400-499).
 * Reports network errors (status 0) and 5xx server errors.
 */
export function shouldReportHttpError(error: unknown): boolean {
  if (error instanceof HttpErrorResponse) {
    if (error.status >= 400 && error.status < 500) {
      return false;
    }
    return true;
  }
  if (error instanceof ApiError) {
    if (error.status >= 400 && error.status < 500) {
      return false;
    }
    return true;
  }
  return true;
}

/**
 * Redacts sensitive fields, query parameters, cookies, request bodies, and emails from Sentry events.
 */
export function redactEvent<T extends Sentry.Event>(event: T): T {
  // Redact request data and cookies, strip query strings
  if (event.request) {
    if (event.request.data !== undefined) {
      event.request.data = '[Redacted]';
    }
    if (event.request.cookies !== undefined) {
      delete event.request.cookies;
    }
    if (event.request.url) {
      event.request.url = event.request.url.split('?')[0];
    }
    if (event.request.headers) {
      event.request.headers = redactValue(event.request.headers) as Record<string, string>;
    }
  }

  // Redact message and logentry
  if (event.message) {
    event.message = event.message.replace(EMAIL_REGEX, '[email]');
  }
  if (event.logentry?.message) {
    event.logentry.message = event.logentry.message.replace(EMAIL_REGEX, '[email]');
  }

  // Redact extra, contexts, tags
  if (event.extra) {
    event.extra = redactValue(event.extra) as Record<string, unknown>;
  }
  if (event.contexts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    event.contexts = redactValue(event.contexts) as any;
  }
  if (event.tags) {
    event.tags = redactValue(event.tags) as Record<string, string>;
  }

  return event;
}

export function initSentry(config: typeof environment): void {
  if (!config.sentryDsn) return;
  try {
    // Sentry Angular docs: https://docs.sentry.io/platforms/javascript/guides/angular/features/error-handler/
    Sentry.init({
      dsn: config.sentryDsn,
      tracesSampleRate: 0.1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...({ sendDefaultPii: false } as any),
      beforeSend(event, hint) {
        if (hint?.originalException && !shouldReportHttpError(hint.originalException)) {
          return null;
        }
        return redactEvent(event);
      },
    });
  } catch {
    // Error reporting must never prevent the application from starting.
  }
}

/**
 * Custom ErrorHandler provider that integrates with Sentry and filters out expected 4xx HTTP/API errors.
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly sentryHandler = Sentry.createErrorHandler();

  handleError(error: unknown): void {
    if (!shouldReportHttpError(error)) {
      return;
    }
    this.sentryHandler.handleError(error);
  }
}

export function provideAppErrorHandler() {
  return {
    provide: ErrorHandler,
    useClass: AppErrorHandler,
  };
}
