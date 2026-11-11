import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from './api-client';
import { ApiError } from './api-error';
import { SessionService } from './session.service';
import { AdminSetupService } from '../features/setup/admin-setup.service';
import { adminRequestedReturnUrl, adminRouterUrl } from './session.service';
import { LoginContextService } from './login-context.service';

export const adminGuard: CanActivateFn = async (_route, state) => {
  const session = inject(SessionService);
  const api = inject(ApiClient);
  const router = inject(Router);
  const setup = inject(AdminSetupService);
  const loginContext = inject(LoginContextService);

  if (!(await session.loadSession())) {
    const returnUrl = session.rememberReturnUrl(adminRequestedReturnUrl(state.url, session.baseHref()));
    return router.createUrlTree(['/login'], returnUrl ? { queryParams: { returnUrl } } : undefined);
  }
  try {
    await firstValueFrom(api.get<unknown>('/admin/config'));
    loginContext.captureAfterAuthenticatedLoad();
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      session.clearReturnUrl();
      return router.createUrlTree(['/forbidden']);
    }
    throw error;
  }

  let setupView;
  try {
    setupView = await setup.load();
  } catch {
    return state.url === '/setup' ? true : router.createUrlTree(['/setup']);
  }
  if (!setupView.complete && state.url !== '/setup') return router.createUrlTree(['/setup']);
  const storedReturnUrl = session.storedReturnUrl();
  if (storedReturnUrl && setupView.complete) {
    const target = adminRouterUrl(storedReturnUrl, session.baseHref());
    session.clearReturnUrl();
    if (target && target !== state.url) return router.parseUrl(target);
  }
  return true;
};
