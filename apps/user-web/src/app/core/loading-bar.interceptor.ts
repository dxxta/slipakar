import { HttpEventType, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize, tap } from 'rxjs';
import { LoadingBarService } from './loading-bar.service';

export const loadingBarInterceptor: HttpInterceptorFn = (request, next) => {
  const bar = inject(LoadingBarService);
  bar.start();
  let ok = false;
  return next(request).pipe(
    tap({
      next: (event) => { if (event.type === HttpEventType.Response) ok = true; },
    }),
    // finalize also runs when the request is cancelled (unsubscribed), which leaves ok=false and shows the error colour.
    finalize(() => bar.complete(ok)),
  );
};
