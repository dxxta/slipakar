import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type SessionUser = { id: string; email: string; name?: string; image?: string | null; role: string };
type SessionResponse = { user: SessionUser; session: unknown } | null;
export const ADMIN_RETURN_URL_STORAGE_KEY = 'slipakar.admin-return-url';

function safeRelativePath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, 'https://slipakar.invalid');
    return url.origin === 'https://slipakar.invalid' ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

export function adminBasePath(baseHref: string): string {
  try {
    const path = new URL(baseHref, 'https://slipakar.invalid').pathname.replace(/\/+$/, '');
    return path === '' ? '' : path;
  } catch {
    return '';
  }
}

export function safeAdminReturnUrl(value: string | null | undefined, baseHref: string): string | null {
  const safe = safeRelativePath(value);
  if (!safe) return null;
  const basePath = adminBasePath(baseHref);
  if (!basePath) return safe;
  const path = new URL(safe, 'https://slipakar.invalid').pathname;
  return path === basePath || path.startsWith(`${basePath}/`) ? safe : null;
}

export function adminRequestedReturnUrl(routeUrl: string, baseHref: string): string | null {
  const safeRoute = safeRelativePath(routeUrl);
  if (!safeRoute) return null;
  const basePath = adminBasePath(baseHref);
  if (!basePath) return safeRoute;
  const routePath = new URL(safeRoute, 'https://slipakar.invalid').pathname;
  const publicUrl = routePath === basePath || routePath.startsWith(`${basePath}/`)
    ? safeRoute
    : routePath === '/'
      ? `${basePath}/${safeRoute.slice(1)}`
      : `${basePath}${safeRoute}`;
  return safeAdminReturnUrl(publicUrl, baseHref);
}

export function adminRouterUrl(returnUrl: string, baseHref: string): string | null {
  const safe = safeAdminReturnUrl(returnUrl, baseHref);
  if (!safe) return null;
  const basePath = adminBasePath(baseHref);
  if (!basePath) return safe;
  const url = new URL(safe, 'https://slipakar.invalid');
  const routePath = url.pathname.slice(basePath.length) || '/';
  return `${routePath.startsWith('/') ? routePath : `/${routePath}`}${url.search}${url.hash}`;
}

export function adminAuthCallbackUrl(origin: string, baseHref: string, returnUrl?: string | null): string {
  const safeReturnUrl = safeAdminReturnUrl(returnUrl, baseHref);
  const target = safeReturnUrl ?? baseHref;
  return new URL(target, `${origin.replace(/\/$/, '')}/`).toString();
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  readonly user = signal<SessionUser | null>(null);
  readonly loading = signal(true);

  baseHref(): string {
    return this.document.querySelector('base')?.getAttribute('href') ?? '/';
  }

  rememberReturnUrl(value: string | null | undefined): string | null {
    const safe = safeAdminReturnUrl(value, this.baseHref());
    if (!safe) {
      this.clearReturnUrl();
      return null;
    }
    try {
      this.document.defaultView?.sessionStorage.setItem(ADMIN_RETURN_URL_STORAGE_KEY, safe);
    } catch {
      return safe;
    }
    return safe;
  }

  storedReturnUrl(): string | null {
    try {
      const stored = this.document.defaultView?.sessionStorage.getItem(ADMIN_RETURN_URL_STORAGE_KEY);
      const safe = safeAdminReturnUrl(stored, this.baseHref());
      if (stored && !safe) this.document.defaultView?.sessionStorage.removeItem(ADMIN_RETURN_URL_STORAGE_KEY);
      return safe;
    } catch {
      return null;
    }
  }

  clearReturnUrl(): void {
    try {
      this.document.defaultView?.sessionStorage.removeItem(ADMIN_RETURN_URL_STORAGE_KEY);
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
  }

  async loadSession(): Promise<SessionUser | null> {
    this.loading.set(true);
    try {
      const response = await firstValueFrom(this.http.get<SessionResponse>(`${environment.apiBase}/api/auth/get-session`, { withCredentials: true }));
      this.user.set(response?.user ?? null);
      return this.user();
    } catch {
      this.user.set(null);
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  async signIn(returnUrl?: string): Promise<void> {
    const view = this.document.defaultView;
    if (!view) return;
    const target = returnUrl === undefined ? this.storedReturnUrl() : this.rememberReturnUrl(returnUrl);
    const response = await firstValueFrom(this.http.post<{ url?: string; redirect?: boolean }>(
      `${environment.apiBase}/api/auth/sign-in/social`,
      {
        provider: 'google',
        callbackURL: adminAuthCallbackUrl(view.location.origin, this.baseHref(), target),
      },
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
