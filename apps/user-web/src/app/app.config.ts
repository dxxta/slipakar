import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { withCredentialsInterceptor } from './core/with-credentials.interceptor';
import { embedSessionInterceptor } from './core/embed-session.interceptor';
import { loadingBarInterceptor } from './core/loading-bar.interceptor';
import { toastInterceptor } from './core/toast.interceptor';
import { provideAppErrorHandler } from './core/error-reporting';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppErrorHandler(),
    provideHttpClient(withFetch(), withInterceptors([embedSessionInterceptor, withCredentialsInterceptor, loadingBarInterceptor, toastInterceptor])),
    provideRouter(routes),
  ],
};
