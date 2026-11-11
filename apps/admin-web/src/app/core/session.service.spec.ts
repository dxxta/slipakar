import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminAuthCallbackUrl, adminRequestedReturnUrl, adminRouterUrl, safeAdminReturnUrl, SessionService } from './session.service';

describe('SessionService', () => {
  let service: SessionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), SessionService] });
    service = TestBed.inject(SessionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    service.clearReturnUrl();
  });

  it('loads a signed-in user into signals', async () => {
    const loaded = service.loadSession();
    http.expectOne('/api/auth/get-session').flush({ user: { id: 'u1', email: 'admin@example.com', image: '/me/avatar/u1?v=hash', role: 'admin' }, session: {} });
    await loaded;
    expect(service.user()?.email).toBe('admin@example.com');
    expect(service.user()?.image).toBe('/me/avatar/u1?v=hash');
    expect(service.loading()).toBe(false);
  });

  it('stores null when there is no session and signs out', async () => {
    const loaded = service.loadSession();
    http.expectOne('/api/auth/get-session').flush(null);
    await loaded;
    expect(service.user()).toBeNull();
    const signedOut = service.signOut();
    http.expectOne('/api/auth/sign-out').flush({ success: true });
    await signedOut;
    expect(service.user()).toBeNull();
  });

  it('uses a safe stored return URL for Google sign-in', async () => {
    const signingIn = service.signIn('/users?sortBy=email#row');
    const request = http.expectOne('/api/auth/sign-in/social');
    expect(request.request.body).toEqual({
      provider: 'google',
      callbackURL: `${window.location.origin}/users?sortBy=email#row`,
    });
    request.flush({});
    await signingIn;
  });

  it('provides credential recovery and account-method requests', async () => {
    const reset = service.requestPasswordReset('admin@example.com');
    const resetRequest = http.expectOne('/api/auth/request-password-reset');
    expect(resetRequest.request.body).toEqual({ email: 'admin@example.com', redirectTo: `${window.location.origin}/reset-password` });
    resetRequest.flush({ status: true }); await reset;

    const accounts = service.listAccounts();
    http.expectOne('/api/auth/list-accounts').flush([{ id: 'credential-1', providerId: 'credential', accountId: 'admin@example.com' }]);
    await expect(accounts).resolves.toEqual([{ id: 'credential-1', providerId: 'credential', accountId: 'admin@example.com' }]);
  });
});

describe('adminAuthCallbackUrl', () => {
  it('uses the app base path in production and root in development', () => {
    expect(adminAuthCallbackUrl('https://slipakar.example', '/console/')).toBe('https://slipakar.example/console/');
    expect(adminAuthCallbackUrl('http://localhost:4301', '/')).toBe('http://localhost:4301/');
  });

  it('constrains production return paths to /console and converts them back to router paths', () => {
    expect(adminRequestedReturnUrl('/users?sortBy=email#row', '/console/')).toBe('/console/users?sortBy=email#row');
    expect(adminAuthCallbackUrl('https://slipakar.example', '/console/', '/console/users?sortBy=email#row'))
      .toBe('https://slipakar.example/console/users?sortBy=email#row');
    expect(safeAdminReturnUrl('https://outside.example/path', '/console/')).toBeNull();
    expect(safeAdminReturnUrl('/console/../../outside', '/console/')).toBeNull();
    expect(adminRouterUrl('/console/users?sortBy=email#row', '/console/')).toBe('/users?sortBy=email#row');
  });
});
