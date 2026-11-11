import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authGuard } from './auth.guard';
import { SessionService } from './session.service';

describe('authGuard', () => {
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    http.verify();
    TestBed.inject(SessionService).clearReturnUrl();
  });

  it('redirects a signed-out visitor to login', async () => {
    const result = TestBed.runInInjectionContext(() => authGuard({} as never, { url: '/notifications?unread=true#announcements' } as never));
    http.expectOne('/api/auth/get-session').flush(null);
    const outcome = await result;
    expect(outcome).toBeInstanceOf(UrlTree);
    if (outcome instanceof UrlTree) {
      expect(router.serializeUrl(outcome)).toContain('/login?returnUrl=');
      expect(outcome.queryParams['returnUrl']).toBe('/notifications?unread=true#announcements');
    }
  });

  it('uses a stored return URL after a successful session and clears it', async () => {
    const session = TestBed.inject(SessionService);
    session.rememberReturnUrl('/notifications?unread=true');
    const result = TestBed.runInInjectionContext(() => authGuard({} as never, { url: '/projects' } as never));
    http.expectOne('/api/auth/get-session').flush({ user: { id: 'u1', email: 'person@example.com', role: 'user' }, session: {} });
    const outcome = await result;
    expect(outcome).toBeInstanceOf(UrlTree);
    if (outcome instanceof UrlTree) expect(router.serializeUrl(outcome)).toBe('/notifications?unread=true');
    expect(session.storedReturnUrl()).toBeNull();
  });

  it('allows a visitor with a session', async () => {
    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    http.expectOne('/api/auth/get-session').flush({ user: { id: 'u1', email: 'person@example.com', role: 'user' }, session: {} });
    await expect(result).resolves.toBe(true);
  });

  it('directs disabled accounts to an explicit access-disabled page', async () => {
    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    http.expectOne('/api/auth/get-session').flush({ error: { code: 'ACCOUNT_DISABLED', message: 'This account is disabled' } }, { status: 403, statusText: 'Forbidden' });
    const outcome = await result;
    expect(outcome).toBeInstanceOf(UrlTree);
    if (outcome instanceof UrlTree) expect(router.serializeUrl(outcome)).toBe('/account-disabled');
  });
});
