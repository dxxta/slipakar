import { inject } from '@angular/core';
import { EmbedSessionService } from './embed-session.service';

import { HttpInterceptorFn } from '@angular/common/http';

export const withCredentialsInterceptor: HttpInterceptorFn = (request, next) => {
  if (inject(EmbedSessionService).isEmbedMode()) return next(request.clone({ withCredentials: false, credentials: 'omit' }));
  return next(request.clone({ withCredentials: true }));
};
