import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type SessionUser = { id: string; email: string; name?: string; image?: string | null; role: string };
type SessionResponse = { user: SessionUser; session: unknown } | null;

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
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

  async signIn(): Promise<void> {
    const response = await firstValueFrom(this.http.post<{ url?: string; redirect?: boolean }>(
      `${environment.apiBase}/api/auth/sign-in/social`,
      { provider: 'google', callbackURL: `${window.location.origin}/` },
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
