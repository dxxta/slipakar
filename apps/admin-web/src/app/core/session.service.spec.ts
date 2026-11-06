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

  afterEach(() => http.verify());

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
});
