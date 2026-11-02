import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

export const authGuard: CanActivateFn = async () => {
  const session = inject(SessionService);
  const router = inject(Router);
  const user = await session.loadSession();
  if (session.accountDisabled()) return router.createUrlTree(['/account-disabled']);
  return user ? true : router.createUrlTree(['/login']);
};
