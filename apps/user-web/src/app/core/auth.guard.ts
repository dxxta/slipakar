import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';
import { LoginContextService } from './login-context.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const session = inject(SessionService);
  const router = inject(Router);
  const loginContext = inject(LoginContextService);
  const user = await session.loadSession();
  if (session.accountDisabled()) {
    session.clearReturnUrl();
    return router.createUrlTree(['/account-disabled']);
  }

  if (user) {
    loginContext.captureAfterAuthenticatedLoad();
    const storedReturnUrl = session.storedReturnUrl();
    if (storedReturnUrl) {
      session.clearReturnUrl();
      if (storedReturnUrl !== state.url) return router.parseUrl(storedReturnUrl);
    }
    return true;
  }

  const returnUrl = session.rememberReturnUrl(state.url);
  return router.createUrlTree(['/login'], returnUrl ? { queryParams: { returnUrl } } : undefined);
};
