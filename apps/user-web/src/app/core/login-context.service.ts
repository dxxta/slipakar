import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { ApiClient } from './api-client';

export const LOGIN_CONTEXT_PENDING_KEY = 'slipakar.login-context-pending';

type LoginCoordinates = { latitude: number; longitude: number; accuracy: number };

@Injectable({ providedIn: 'root' })
export class LoginContextService {
  private readonly document = inject(DOCUMENT);
  private readonly api = inject(ApiClient);

  markPending(): void {
    try {
      this.document.defaultView?.sessionStorage.setItem(LOGIN_CONTEXT_PENDING_KEY, '1');
    } catch {
      // Storage may be unavailable in restricted browser contexts.
    }
  }

  clearPending(): void {
    try {
      this.document.defaultView?.sessionStorage.removeItem(LOGIN_CONTEXT_PENDING_KEY);
    } catch {
      // Storage may be unavailable in restricted browser contexts.
    }
  }

  captureAfterAuthenticatedLoad(): void {
    const view = this.document.defaultView;
    if (!view) return;

    let pending = false;
    try {
      pending = view.sessionStorage.getItem(LOGIN_CONTEXT_PENDING_KEY) === '1';
      if (pending) view.sessionStorage.removeItem(LOGIN_CONTEXT_PENDING_KEY);
    } catch {
      return;
    }
    if (!pending) return;

    try {
      const geolocation = view.navigator.geolocation;
      if (!geolocation) return;
      geolocation.getCurrentPosition(
        (position) => {
          const coordinates: LoginCoordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          try {
            this.api.post<{ updated: boolean }, LoginCoordinates>('/me/login-context', coordinates).subscribe({
              error: () => undefined,
            });
          } catch {
            // Network and API failures are intentionally silent.
          }
        },
        () => undefined,
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
      );
    } catch {
      // Location permission, browser support, and network failures are silent and never retried.
    }
  }
}
