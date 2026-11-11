import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { EmbedSessionService } from './embed-session.service';

export const embedSessionInterceptor: HttpInterceptorFn = (request, next) => {
  const embed = inject(EmbedSessionService);
  if (!embed.isEmbedMode()) return next(request);
  const token = embed.session()?.token;
  const headers = token ? request.headers.set('Authorization', `Bearer ${token}`) : request.headers;
  return next(request.clone({ headers, withCredentials: false, credentials: 'omit' })).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) embed.expire();
      return throwError(() => error);
    }),
  );
};
