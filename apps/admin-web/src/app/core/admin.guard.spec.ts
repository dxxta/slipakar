import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SessionService } from './session.service';
import { adminGuard } from './admin.guard';

describe('adminGuard', () => {
  let http: HttpTestingController;
  let session: SessionService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), SessionService] });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    http.verify();
    session.clearReturnUrl();
    TestBed.resetTestingModule();
  });

  it('redirects a signed-out user to login', async () => {
    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, { url: '/users?sortBy=email#row' } as never));
    http.expectOne('/api/auth/get-session').flush(null);
    const outcome = await result;
    expect(outcome).not.toBe(true);
    expect(outcome).toBeInstanceOf(UrlTree);
    if (outcome instanceof UrlTree) {
      expect(outcome.queryParams['returnUrl']).toBe('/users?sortBy=email#row');
      expect(router.serializeUrl(outcome)).toContain('/login?returnUrl=');
    }
  });

  it('redirects a signed-in non-admin to forbidden on 403', async () => {
    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
    http.expectOne('/api/auth/get-session').flush({ user: { id: 'u', email: 'user@example.com', role: 'user' }, session: {} });
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne('/admin/config').flush({ error: { code: 'FORBIDDEN', message: 'Admin only' } }, { status: 403, statusText: 'Forbidden' });
    const outcome = await result;
    expect(outcome).not.toBe(true);
    expect(outcome).toBeInstanceOf(UrlTree);
    if (outcome instanceof UrlTree) expect(router.serializeUrl(outcome)).toBe('/forbidden');
  });

  it('allows a signed-in admin', async () => {
    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, { url: '/flags' } as never));
    http.expectOne('/api/auth/get-session').flush({ user: { id: 'a', email: 'admin@example.com', role: 'admin' }, session: {} });
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne('/admin/config').flush({ success: true, message: 'ok', data: [] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne('/admin/setup').flush({ success: true, message: 'ok', data: { complete: true, integrations: [] } });
    await expect(result).resolves.toBe(true);
    expect(session.user()?.role).toBe('admin');
  });

  it('returns a signed-in admin to the stored page after auth checks pass', async () => {
    session.rememberReturnUrl('/broadcasts?sortBy=subject#history');
    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, { url: '/flags' } as never));
    http.expectOne('/api/auth/get-session').flush({ user: { id: 'a', email: 'admin@example.com', role: 'admin' }, session: {} });
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne('/admin/config').flush({ success: true, message: 'ok', data: [] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne('/admin/setup').flush({ success: true, message: 'ok', data: { complete: true, integrations: [] } });

    const outcome = await result;
    expect(outcome).toBeInstanceOf(UrlTree);
    if (outcome instanceof UrlTree) expect(router.serializeUrl(outcome)).toBe('/broadcasts?sortBy=subject#history');
    expect(session.storedReturnUrl()).toBeNull();
  });

  it('redirects feature pages to setup while any integration test is failing', async () => {
    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, { url: '/flags' } as never));
    http.expectOne('/api/auth/get-session').flush({ user: { id: 'a', email: 'admin@example.com', role: 'admin' }, session: {} });
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne('/admin/config').flush({ success: true, message: 'ok', data: [] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne('/admin/setup').flush({
      success: true,
      message: 'ok',
      data: { complete: false, integrations: [{ key: 'grafana', configured: true, lastStatus: 'failed' }] },
    });

    const outcome = await result;
    expect(outcome).toBeInstanceOf(UrlTree);
    if (outcome instanceof UrlTree) expect(router.serializeUrl(outcome)).toBe('/setup');
  });

  it('keeps the setup page reachable while configuration is incomplete', async () => {
    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, { url: '/setup' } as never));
    http.expectOne('/api/auth/get-session').flush({ user: { id: 'a', email: 'admin@example.com', role: 'admin' }, session: {} });
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne('/admin/config').flush({ success: true, message: 'ok', data: [] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne('/admin/setup').flush({ success: true, message: 'ok', data: { complete: false, integrations: [] } });

    await expect(result).resolves.toBe(true);
  });
});
