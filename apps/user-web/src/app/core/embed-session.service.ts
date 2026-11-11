import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import type { EmbedScope, EmbedTheme } from './embed-types';
import { ThemePreferencesService } from './theme-preferences.service';

export type EmbedSession = {
  token: string;
  projectId: string;
  scopes: EmbedScope[];
  theme: EmbedTheme | null;
  expiresAt: string;
  parentOrigin: string;
};
export type EmbedState = 'initializing' | 'ready' | 'disabled' | 'expired' | 'error';
type EmbedEnvelope<T> = { message: string; data: T; success: true };
type ExchangeResponse = Omit<EmbedSession, 'token'> & { token: string };
const storageKey = 'slipakar.embed-session';
const allowedScopes: readonly EmbedScope[] = ['templates:read', 'templates:write', 'uploads:read', 'uploads:write', 'mappings:read', 'mappings:write', 'campaigns:read', 'campaigns:write', 'campaigns:send', 'recipients:read'];

@Injectable({ providedIn: 'root' })
export class EmbedSessionService {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly rawHttp = new HttpClient(inject(HttpBackend));
  private readonly themePreferences = inject(ThemePreferencesService);
  readonly isEmbedMode = signal(this.detectEmbedMode());
  readonly state = signal<EmbedState>(this.isEmbedMode() ? 'initializing' : 'error');
  readonly session = signal<EmbedSession | null>(null);
  private initialization: Promise<void> | null = null;
  private expiryTimer: number | null = null;

  enableMode(): void {
    this.isEmbedMode.set(true);
  }

  initialize(): Promise<void> {
    this.enableMode();
    this.initialization ??= this.initializeSession();
    return this.initialization;
  }

  hasScope(scope: EmbedScope): boolean {
    return this.session()?.scopes.includes(scope) ?? false;
  }

  hasScopes(scopes: readonly string[]): boolean {
    const session = this.session();
    return Boolean(session && scopes.every((scope) => session.scopes.includes(scope as EmbedScope)));
  }

  expire(): void {
    if (!this.isEmbedMode()) return;
    const view = this.document.defaultView;
    if (view && this.expiryTimer !== null) view.clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
    this.clearStoredSession();
    this.session.set(null);
    this.state.set('expired');
    this.postToParent({ source: 'slipakar', type: 'expired' });
  }

  postResize(height: number): void {
    if (Number.isFinite(height) && height >= 0) this.postToParent({ source: 'slipakar', type: 'resize', height: Math.ceil(height) });
  }

  private async initializeSession(): Promise<void> {
    if (!this.browser) return;
    this.state.set('initializing');
    const token = this.readLaunchToken();
    if (token !== null) {
      this.removeLaunchTokenFromAddressBar();
      try {
        const envelope = await firstValueFrom(this.rawHttp.post<EmbedEnvelope<ExchangeResponse>>(
          `${environment.apiBase}/embed/exchange`, { token }, { withCredentials: false, credentials: 'omit' },
        ));
        const session = { ...envelope.data };
        if (!this.isValidSession(session)) {
          this.state.set('error');
          return;
        }
        if (!this.saveSession(session)) return;
        this.activate(session);
      } catch (error: unknown) {
        this.state.set(error instanceof HttpErrorResponse && error.status === 404 ? 'disabled' : error instanceof HttpErrorResponse && error.status === 401 ? 'expired' : 'error');
      }
      return;
    }

    const stored = this.readStoredSession();
    if (!stored) {
      this.state.set('expired');
      return;
    }
    this.activate(stored);
  }

  private activate(session: EmbedSession): void {
    this.session.set(session);
    this.state.set('ready');
    this.themePreferences.applyEmbedTheme(session.theme);
    this.scheduleExpiry(session);
    this.postToParent({ source: 'slipakar', type: 'ready' });
  }

  private scheduleExpiry(session: EmbedSession): void {
    const view = this.document.defaultView;
    if (!view) return;
    if (this.expiryTimer !== null) view.clearTimeout(this.expiryTimer);
    const remaining = new Date(session.expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      this.expire();
      return;
    }
    this.expiryTimer = view.setTimeout(() => this.expire(), remaining);
  }

  private readLaunchToken(): string | null {
    try {
      const view = this.document.defaultView;
      if (!view) return null;
      const url = new URL(view.location.href);
      return url.searchParams.has('token') ? (url.searchParams.get('token') ?? '') : null;
    } catch {
      return null;
    }
  }

  private removeLaunchTokenFromAddressBar(): void {
    const view = this.document.defaultView;
    if (!view) return;
    try { view.history.replaceState(view.history.state, '', `${view.location.pathname}${view.location.hash}`); } catch { /* The browser may deny history access in a restricted frame. */ }
  }

  private readStoredSession(): EmbedSession | null {
    try {
      const raw = this.document.defaultView?.sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!this.isValidSession(parsed)) {
        this.clearStoredSession();
        return null;
      }
      return parsed;
    } catch {
      this.clearStoredSession();
      return null;
    }
  }

  private saveSession(session: EmbedSession): boolean {
    try {
      this.document.defaultView?.sessionStorage.setItem(storageKey, JSON.stringify(session));
      return true;
    } catch {
      this.state.set('error');
      return false;
    }
  }

  private clearStoredSession(): void {
    try { this.document.defaultView?.sessionStorage.removeItem(storageKey); } catch { /* Storage can be unavailable. */ }
  }

  private isValidSession(value: unknown): value is EmbedSession {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Partial<EmbedSession>;
    if (typeof candidate.token !== 'string' || !/^slpe_[A-Za-z0-9_-]{43}$/.test(candidate.token)) return false;
    if (typeof candidate.projectId !== 'string' || !candidate.projectId || typeof candidate.expiresAt !== 'string' || !Number.isFinite(Date.parse(candidate.expiresAt)) || new Date(candidate.expiresAt).getTime() <= Date.now()) return false;
    if (typeof candidate.parentOrigin !== 'string' || !this.isOrigin(candidate.parentOrigin)) return false;
    if (!Array.isArray(candidate.scopes) || !candidate.scopes.length || candidate.scopes.some((scope) => !allowedScopes.includes(scope as EmbedScope))) return false;
    if (candidate.theme !== null && candidate.theme !== undefined && !this.isValidTheme(candidate.theme)) return false;
    return true;
  }

  private isValidTheme(value: unknown): value is EmbedTheme {
    if (typeof value !== 'object' || value === null) return false;
    const theme = value as EmbedTheme;
    return (theme.mode === undefined || ['light', 'dark', 'system'].includes(theme.mode))
      && (theme.style === undefined || ['styled', 'unstyled'].includes(theme.style))
      && ['accent', 'secondary', 'third'].every((key) => {
        const color = theme[key as 'accent' | 'secondary' | 'third'];
        return color === undefined || /^#[0-9A-Fa-f]{6}$/.test(color);
      });
  }

  private isOrigin(value: string): boolean {
    try {
      const url = new URL(value);
      return url.origin === value && (url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost')) && !url.username && !url.password;
    } catch { return false; }
  }

  private postToParent(message: { source: 'slipakar'; type: 'ready' | 'expired' } | { source: 'slipakar'; type: 'resize'; height: number }): void {
    if (!this.browser) return;
    const view = this.document.defaultView;
    const targetOrigin = this.session()?.parentOrigin;
    if (!view || !targetOrigin || !this.isOrigin(targetOrigin) || view.parent === view) return;
    view.parent.postMessage(message, targetOrigin);
  }

  private detectEmbedMode(): boolean {
    if (!this.browser) return false;
    const view = this.document.defaultView;
    const path = view?.location.pathname;
    if (path && (path === '/embed' || path.startsWith('/embed/'))) return true;
    if (!view || view.parent === view) return false;
    try { return Boolean(view.sessionStorage.getItem(storageKey)); } catch { return false; }
  }
}
