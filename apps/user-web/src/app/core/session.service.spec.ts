import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SessionService } from './session.service';

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
    http.expectOne('/api/auth/get-session').flush({ user: { id: 'u1', email: 'admin@example.com', role: 'admin' }, session: {} });
    await loaded;
    expect(service.user()?.email).toBe('admin@example.com');
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

  it('uses only a safe same-origin return URL as the Google callback', async () => {
    const signingIn = service.signIn('/notifications?unread=true#announcements');
    const request = http.expectOne('/api/auth/sign-in/social');
    expect(request.request.body).toEqual({
      provider: 'google',
      callbackURL: `${window.location.origin}/notifications?unread=true#announcements`,
    });
    request.flush({});
    await signingIn;

    const rejected = service.signIn('https://outside.example/');
    const safeRequest = http.expectOne('/api/auth/sign-in/social');
    expect(safeRequest.request.body).toEqual({ provider: 'google', callbackURL: `${window.location.origin}/` });
    safeRequest.flush({});
    await rejected;
  });

  it('posts credential sign-up and reset requests with the frontend callback URLs', async () => {
    const signup = service.signUpWithEmail('Person', ' person@example.com ', 'long-enough-password', `${window.location.origin}/verify-email`);
    const signupRequest = http.expectOne('/api/auth/sign-up/email');
    expect(signupRequest.request.body).toEqual({ name: 'Person', email: 'person@example.com', password: 'long-enough-password', callbackURL: `${window.location.origin}/verify-email` });
    signupRequest.flush({ token: null }); await signup;

    const reset = service.requestPasswordReset(' person@example.com ');
    const resetRequest = http.expectOne('/api/auth/request-password-reset');
    expect(resetRequest.request.body).toEqual({ email: 'person@example.com', redirectTo: `${window.location.origin}/reset-password` });
    resetRequest.flush({ status: true }); await reset;
  });

  it('posts password reset and change requests and reads account methods', async () => {
    const reset = service.resetPassword('opaque-token', 'new-long-password');
    const resetRequest = http.expectOne('/api/auth/reset-password');
    expect(resetRequest.request.body).toEqual({ token: 'opaque-token', newPassword: 'new-long-password' });
    resetRequest.flush({ status: true }); await reset;

    const change = service.changePassword('old-long-password', 'new-long-password');
    const changeRequest = http.expectOne('/api/auth/change-password');
    expect(changeRequest.request.body).toEqual({ currentPassword: 'old-long-password', newPassword: 'new-long-password' });
    changeRequest.flush({ status: true }); await change;

    const accounts = service.listAccounts();
    http.expectOne('/api/auth/list-accounts').flush([{ id: 'account-1', providerId: 'google', accountId: 'google-user' }]);
    await expect(accounts).resolves.toEqual([{ id: 'account-1', providerId: 'google', accountId: 'google-user' }]);
  });
});
