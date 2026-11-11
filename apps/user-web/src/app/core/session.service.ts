import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type SessionUser = { id: string; email: string; name?: string; image?: string | null; role: string };
type SessionResponse = { user: SessionUser; session: unknown } | null;
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

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
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
    const response = await firstValueFrom(this.http.post<{ url?: string; redirect?: boolean }>(
      `${environment.apiBase}/api/auth/sign-in/social`,
      { provider: 'google', callbackURL },
      { withCredentials: true },
    ));
    if (response.url) view.location.assign(response.url);
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
