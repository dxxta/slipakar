import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import * as Sentry from '@sentry/angular';
import {
  initSentry,
  redactEvent,
  shouldReportHttpError,
  sanitizeUrlPattern,
  AppErrorHandler,
} from './error-reporting';
import { ApiError } from './api-error';

const mockSentryErrorHandler = {
  handleError: vi.fn(),
};

vi.mock('@sentry/angular', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sentry/angular')>();
  return {
    ...actual,
    init: vi.fn(),
    createErrorHandler: vi.fn(() => mockSentryErrorHandler),
  };
});

describe('Sentry error reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initSentry', () => {
    it('does nothing when sentryDsn is empty', () => {
      initSentry({ sentryDsn: '', apiBase: '' });
      expect(Sentry.init).not.toHaveBeenCalled();
    });

    it('initializes Sentry when sentryDsn is provided', () => {
      initSentry({ sentryDsn: 'https://public@sentry.example.com/1', apiBase: '' });
      expect(Sentry.init).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(Sentry.init).mock.calls[0][0] as Record<string, unknown>;
      expect(callArgs['dsn']).toBe('https://public@sentry.example.com/1');
      expect(callArgs['tracesSampleRate']).toBe(0.1);
      expect(callArgs['sendDefaultPii']).toBe(false);
      expect(typeof callArgs['beforeSend']).toBe('function');
    });

    it('beforeSend drops 4xx errors but allows 5xx and other errors', () => {
      initSentry({ sentryDsn: 'https://public@sentry.example.com/1', apiBase: '' });
      const callArgs = vi.mocked(Sentry.init).mock.calls[0][0];
      const beforeSend = callArgs?.beforeSend!;
      const sampleEvent: Sentry.ErrorEvent = { message: 'err', type: undefined };

      const http404 = new HttpErrorResponse({ status: 404 });
      const result404 = beforeSend(sampleEvent, { originalException: http404 });
      expect(result404).toBeNull();

      const http500 = new HttpErrorResponse({ status: 500 });
      const result500 = beforeSend(sampleEvent, { originalException: http500 });
      expect(result500).not.toBeNull();
    });
  });

  describe('redactEvent', () => {
    it('drops request data and cookies', () => {
      const event: Sentry.Event = {
        message: 'Something failed',
        request: {
          url: 'https://api.example.com/items?token=secret123&page=1',
          data: { password: 'pass', email: 'test@example.com' },
          cookies: { session: 'session-id' },
          headers: { 'Authorization': 'Bearer 12345' },
        },
      };

      const redacted = redactEvent(event);
      expect(redacted).not.toBeNull();
      expect(redacted.request?.data).toBe('[Redacted]');
      expect(redacted.request?.cookies).toBeUndefined();
      expect(redacted.request?.url).toBe('https://api.example.com/items');
    });

    it('redacts sensitive keys recursively in extra, contexts, and tags', () => {
      const event: Sentry.Event = {
        extra: {
          apiKey: 'super-secret',
          user_token: 'tok-abc',
          dsn: 'https://secret@sentry.io/1',
          nested: {
            authPassword: 'hidden',
            safeField: 'hello',
          },
        },
        tags: {
          authorization: 'Bearer token',
          normalTag: 'fine',
        },
      };

      const redacted = redactEvent(event);
      expect(redacted.extra?.['apiKey']).toBe('[Redacted]');
      expect(redacted.extra?.['user_token']).toBe('[Redacted]');
      expect(redacted.extra?.['dsn']).toBe('[Redacted]');
      const nested = redacted.extra?.['nested'] as Record<string, unknown>;
      expect(nested['authPassword']).toBe('[Redacted]');
      expect(nested['safeField']).toBe('hello');
      expect(redacted.tags?.['authorization']).toBe('[Redacted]');
      expect(redacted.tags?.['normalTag']).toBe('fine');
    });

    it('replaces email addresses with [email] across string values', () => {
      const event: Sentry.Event = {
        message: 'Failed to deliver to recipient john.doe@example.com in campaign',
        logentry: {
          message: 'Notification to alice+alerts@domain.co.uk failed',
        },
        extra: {
          details: 'Sent message to bob@sub.corp.org',
        },
      };

      const redacted = redactEvent(event);
      expect(redacted.message).toBe('Failed to deliver to recipient [email] in campaign');
      expect(redacted.logentry?.message).toBe('Notification to [email] failed');
      expect(redacted.extra?.['details']).toBe('Sent message to [email]');
    });
  });

  describe('shouldReportHttpError', () => {
    it('suppresses 4xx errors (400, 401, 403, 404, 409, 422)', () => {
      const http400 = new HttpErrorResponse({ status: 400, statusText: 'Bad Request' });
      const api404 = new ApiError(404, 'NOT_FOUND', 'Project not found');
      const api409 = new ApiError(409, 'CONFLICT', 'Email exists');

      expect(shouldReportHttpError(http400)).toBe(false);
      expect(shouldReportHttpError(api404)).toBe(false);
      expect(shouldReportHttpError(api409)).toBe(false);
    });

    it('allows network errors (status 0)', () => {
      const netError = new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' });
      const apiNetError = new ApiError(0, 'NETWORK_ERROR', 'Request failed');

      expect(shouldReportHttpError(netError)).toBe(true);
      expect(shouldReportHttpError(apiNetError)).toBe(true);
    });

    it('allows 5xx server errors (500, 502, 503)', () => {
      const http500 = new HttpErrorResponse({ status: 500, statusText: 'Internal Server Error' });
      const api503 = new ApiError(503, 'SERVICE_UNAVAILABLE', 'Temporarily unavailable');

      expect(shouldReportHttpError(http500)).toBe(true);
      expect(shouldReportHttpError(api503)).toBe(true);
    });

    it('allows standard JavaScript errors', () => {
      const err = new TypeError('Cannot read properties of undefined');
      expect(shouldReportHttpError(err)).toBe(true);
    });
  });

  describe('sanitizeUrlPattern', () => {
    it('strips query strings and replaces UUIDs and numeric IDs with route parameter placeholders', () => {
      const url = 'https://api.example.com/projects/123e4567-e89b-12d3-a456-426614174000/campaigns/98765/send?dryRun=true';
      expect(sanitizeUrlPattern(url)).toBe('https://api.example.com/projects/:id/campaigns/:id/send');
    });
  });

  describe('AppErrorHandler', () => {
    it('delegates 5xx and unhandled errors to Sentry', () => {
      const handler = new AppErrorHandler();
      const err = new Error('Crash');
      handler.handleError(err);
      expect(mockSentryErrorHandler.handleError).toHaveBeenCalledWith(err);
    });

    it('suppresses 4xx errors from reaching Sentry', () => {
      const handler = new AppErrorHandler();
      const err = new ApiError(404, 'NOT_FOUND', 'Not found');
      handler.handleError(err);
      expect(mockSentryErrorHandler.handleError).not.toHaveBeenCalled();
    });
  });
});
