import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type SessionUser = { id: string; email: string; name?: string; image?: string | null; role: string };
type SessionResponse = { user: SessionUser; session: unknown } | null;

export function adminAuthCallbackUrl(origin: string, baseHref: string): string {
  return new URL(baseHref, `${origin.replace(/\/$/, '')}/`).toString();
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  readonly user = signal<SessionUser | null>(null);
  readonly loading = signal(true);

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

  async signIn(): Promise<void> {
    const response = await firstValueFrom(this.http.post<{ url?: string; redirect?: boolean }>(
      `${environment.apiBase}/api/auth/sign-in/social`,
      {
        provider: 'google',
        callbackURL: adminAuthCallbackUrl(
          window.location.origin,
          this.document.querySelector('base')?.getAttribute('href') ?? '/',
        ),
      },
      { withCredentials: true },
    ));
    if (response.url) window.location.assign(response.url);
  }

  async signOut(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${environment.apiBase}/api/auth/sign-out`, {}, { withCredentials: true }));
    } finally {
      this.user.set(null);
    }
  }
}
