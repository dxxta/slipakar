import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from './api-client';
import { ApiError } from './api-error';
import { SessionService } from './session.service';
import { AdminSetupService } from '../features/setup/admin-setup.service';

export const adminGuard: CanActivateFn = async (_route, state) => {
  const session = inject(SessionService);
  const api = inject(ApiClient);
  const router = inject(Router);
  const setup = inject(AdminSetupService);

  if (!(await session.loadSession())) return router.createUrlTree(['/login']);
  try {
    await firstValueFrom(api.get<unknown>('/admin/config'));
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return router.createUrlTree(['/forbidden']);
    throw error;
  }

  let setupView;
  try {
    setupView = await setup.load();
  } catch {
    return state.url === '/setup' ? true : router.createUrlTree(['/setup']);
  }
  if (!setupView.complete && state.url !== '/setup') return router.createUrlTree(['/setup']);
  return true;
};
