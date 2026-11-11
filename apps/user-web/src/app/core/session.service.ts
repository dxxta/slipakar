import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoginContextService } from './login-context.service';

export type SessionUser = { id: string; email: string; emailVerified?: boolean; name?: string; image?: string | null; role: string };
type SessionResponse = { user: SessionUser; session: unknown } | null;
type EmailAuthResponse = { user?: SessionUser; token?: string | null; status?: boolean };
export type AuthAccountView = { id: string; providerId: string; accountId: string };
export const USER_RETURN_URL_STORAGE_KEY = 'slipakar.user-return-url';

export function safeUserReturnUrl(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, 'https://slipakar.invalid');
    return url.origin === 'https://slipakar.invalid' ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

export function credentialAuthErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'The request could not be completed. Please try again.';
  const response: unknown = error.error;
  if (!response || typeof response !== 'object') return 'The request could not be completed. Please try again.';
  const body = response as { code?: unknown; error?: { code?: unknown } };
  const code = typeof body.code === 'string' ? body.code : typeof body.error?.code === 'string' ? body.error.code : null;
  if (code === 'INVALID_EMAIL_OR_PASSWORD') return 'Email or password is incorrect.';
  if (code === 'EMAIL_NOT_VERIFIED') return 'Verify your email address before signing in.';
  if (code === 'ACCOUNT_DISABLED') return 'This account is disabled. Contact your administrator.';
  if (code === 'EMAIL_UNAVAILABLE') return 'Credential login needs platform email delivery. Sign in with Google or contact your administrator.';
  if (code === 'PASSWORD_TOO_SHORT') return 'Use a password with at least 12 characters.';
  if (code === 'INVALID_TOKEN') return 'This link is invalid or expired. Request a new email.';
  return 'The request could not be completed. Please try again.';
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly loginContext = inject(LoginContextService);
  readonly user = signal<SessionUser | null>(null);
  readonly loading = signal(true);
  readonly accountDisabled = signal(false);

  async loadSession(): Promise<SessionUser | null> {
    this.loading.set(true);
    this.accountDisabled.set(false);
    try {
      const response = await firstValueFrom(this.http.get<SessionResponse>(`${environment.apiBase}/api/auth/get-session`, { withCredentials: true }));
      this.user.set(response?.user ?? null);
      return this.user();
    } catch (error: unknown) {
      this.user.set(null);
      const body = error instanceof HttpErrorResponse ? error.error as { error?: { code?: string } } | null : null;
      this.accountDisabled.set(error instanceof HttpErrorResponse && error.status === 403 && body?.error?.code === 'ACCOUNT_DISABLED');
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  rememberReturnUrl(value: string | null | undefined): string | null {
    const safe = safeUserReturnUrl(value);
    if (!safe) {
      this.clearReturnUrl();
      return null;
    }
    try {
      this.document.defaultView?.sessionStorage.setItem(USER_RETURN_URL_STORAGE_KEY, safe);
    } catch {
      return safe;
    }
    return safe;
  }

  storedReturnUrl(): string | null {
    try {
      const stored = this.document.defaultView?.sessionStorage.getItem(USER_RETURN_URL_STORAGE_KEY);
      const safe = safeUserReturnUrl(stored);
      if (stored && !safe) this.document.defaultView?.sessionStorage.removeItem(USER_RETURN_URL_STORAGE_KEY);
      return safe;
    } catch {
      return null;
    }
  }

  clearReturnUrl(): void {
    try {
      this.document.defaultView?.sessionStorage.removeItem(USER_RETURN_URL_STORAGE_KEY);
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
  }

  async signIn(returnUrl?: string): Promise<void> {
    const view = this.document.defaultView;
    if (!view) return;
    const requestedReturnUrl = returnUrl === undefined ? this.storedReturnUrl() : this.rememberReturnUrl(returnUrl);
    const callbackURL = new URL(requestedReturnUrl ?? '/', view.location.origin).toString();
    this.loginContext.markPending();
    try {
      const response = await firstValueFrom(this.http.post<{ url?: string; redirect?: boolean }>(
        `${environment.apiBase}/api/auth/sign-in/social`,
        { provider: 'google', callbackURL },
        { withCredentials: true },
      ));
      if (response.url) view.location.assign(response.url);
      else this.loginContext.clearPending();
    } catch (error: unknown) {
      this.loginContext.clearPending();
      throw error;
    }
  }

  callbackUrlFor(returnUrl?: string, fallbackPage = '/'): string {
    const view = this.document.defaultView;
    if (!view) return fallbackPage;
    const requested = returnUrl === undefined ? this.storedReturnUrl() : this.rememberReturnUrl(returnUrl);
    const target = safeUserReturnUrl(requested) ?? safeUserReturnUrl(fallbackPage) ?? '/';
    return new URL(target, view.location.origin).toString();
  }

  frontendPageUrl(page: string): string {
    const view = this.document.defaultView;
    if (!view) return '/';
    const route = page.startsWith('/') ? page : `/${page}`;
    return new URL(route, view.location.origin).toString();
  }

  async signInWithEmail(email: string, password: string, returnUrl?: string): Promise<SessionUser> {
    const response = await firstValueFrom(this.http.post<EmailAuthResponse>(
      `${environment.apiBase}/api/auth/sign-in/email`,
      { email: email.trim(), password, callbackURL: this.callbackUrlFor(returnUrl) },
      { withCredentials: true },
    ));
    if (!response.user) throw new Error('Credential sign-in did not return a user');
    this.loginContext.markPending();
    this.user.set(response.user);
    return response.user;
  }

  async signUpWithEmail(name: string, email: string, password: string, callbackURL: string): Promise<void> {
    await firstValueFrom(this.http.post<EmailAuthResponse>(
      `${environment.apiBase}/api/auth/sign-up/email`,
      { name: name.trim(), email: email.trim(), password, callbackURL },
      { withCredentials: true },
    ));
  }

  async requestPasswordReset(email: string, redirectTo = this.frontendPageUrl('reset-password')): Promise<void> {
    await firstValueFrom(this.http.post(`${environment.apiBase}/api/auth/request-password-reset`, {
      email: email.trim(),
      redirectTo,
    }, { withCredentials: true }));
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await firstValueFrom(this.http.post(`${environment.apiBase}/api/auth/reset-password`, {
      token,
      newPassword,
    }, { withCredentials: true }));
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await firstValueFrom(this.http.post(`${environment.apiBase}/api/auth/change-password`, {
      currentPassword,
      newPassword,
    }, { withCredentials: true }));
  }

  async listAccounts(): Promise<AuthAccountView[]> {
    return firstValueFrom(this.http.get<AuthAccountView[]>(`${environment.apiBase}/api/auth/list-accounts`, { withCredentials: true }));
  }

  async linkGoogle(callbackURL = this.frontendPageUrl('profile')): Promise<void> {
    const view = this.document.defaultView;
    if (!view) return;
    const response = await firstValueFrom(this.http.post<{ url?: string }>(
      `${environment.apiBase}/api/auth/link-social`,
      { provider: 'google', callbackURL },
      { withCredentials: true },
    ));
    if (response.url) view.location.assign(response.url);
  }

  async unlinkAccount(accountId: string): Promise<void> {
    await firstValueFrom(this.http.post(`${environment.apiBase}/api/auth/unlink-account`, { accountId }, { withCredentials: true }));
  }

  async signOut(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${environment.apiBase}/api/auth/sign-out`, {}, { withCredentials: true }));
    } finally {
      this.user.set(null);
      this.clearReturnUrl();
    }
  }
}
