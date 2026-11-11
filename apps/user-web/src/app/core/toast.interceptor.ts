import { HttpErrorResponse, HttpEventType, type HttpInterceptorFn } from '@angular/common/http';
import { toast } from '@spartan-ng/brain/sonner';
import { tap } from 'rxjs';

// Requests that are not form submissions the user needs confirmation for (queries sent as POST, auto-saves, auth).
const SILENT_SUCCESS = /\/(test|preview|read|read-all|mark-all-read)(\/|\?|$)|\/api\/auth\/(sign-in|sign-out|get-session)|\/me\/login-context(?:\?|$)/;
const PREFERENCES = /\/me\/preferences/;
const SILENT_ERROR = /\/api\/auth\/(sign-in|sign-out|get-session)|\/me\/login-context(?:\?|$)/;

const FALLBACK: Record<string, string> = { POST: 'Done.', PUT: 'Changes saved.', PATCH: 'Changes saved.', DELETE: 'Deleted.' };

function message(body: unknown): string | null {
  if (body && typeof body === 'object' && 'message' in body && typeof (body as { message: unknown }).message === 'string') {
    return (body as { message: string }).message;
  }
  return null;
}

function errorMessage(error: HttpErrorResponse): string {
  const body = error.error as { error?: { message?: string }; message?: string } | null;
  return body?.error?.message ?? (typeof body?.message === 'string' ? body.message : null) ?? (error.status === 0 ? 'Network error. Please try again.' : 'Something went wrong. Please try again.');
}

/** Shows a top-right toast when a form submission (POST, PUT, PATCH, DELETE) succeeds or fails. */
export const toastInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return next(request);
  return next(request).pipe(
    tap({
      next: (event) => {
        if (event.type !== HttpEventType.Response || SILENT_SUCCESS.test(request.url)) return;
        if (PREFERENCES.test(request.url)) { toast.success('Appearance saved.', { id: 'preferences' }); return; }
        toast.success(message(event.body) ?? FALLBACK[request.method] ?? 'Done.');
      },
      error: (error: unknown) => {
        if (!(error instanceof HttpErrorResponse) || SILENT_ERROR.test(request.url)) return;
        toast.error(errorMessage(error));
      },
    }),
  );
};
