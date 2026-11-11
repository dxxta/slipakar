import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOGIN_CONTEXT_PENDING_KEY, LoginContextService } from './login-context.service';

describe('LoginContextService', () => {
  let service: LoginContextService;
  let http: HttpTestingController;
  let getCurrentPosition: ReturnType<typeof vi.fn>;
  let originalGeolocation: PropertyDescriptor | undefined;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LoginContextService);
    http = TestBed.inject(HttpTestingController);
    window.sessionStorage.removeItem(LOGIN_CONTEXT_PENDING_KEY);
    originalGeolocation = Object.getOwnPropertyDescriptor(window.navigator, 'geolocation');
    getCurrentPosition = vi.fn();
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });
  });

  afterEach(() => {
    http.verify();
    window.sessionStorage.removeItem(LOGIN_CONTEXT_PENDING_KEY);
    if (originalGeolocation) Object.defineProperty(window.navigator, 'geolocation', originalGeolocation);
    else Reflect.deleteProperty(window.navigator, 'geolocation');
  });

  it('does not prompt without a pending sign-in marker and consumes the marker once', () => {
    service.captureAfterAuthenticatedLoad();
    expect(getCurrentPosition).not.toHaveBeenCalled();

    service.markPending();
    service.captureAfterAuthenticatedLoad();
    service.captureAfterAuthenticatedLoad();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(LOGIN_CONTEXT_PENDING_KEY)).toBeNull();
    expect(getCurrentPosition.mock.calls[0]?.[2]).toEqual({ enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
  });

  it('posts coordinates after a successful browser location response', () => {
    getCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({ coords: { latitude: 37.42291, longitude: -122.08411, accuracy: 18 } } as GeolocationPosition);
    });
    service.markPending();
    service.captureAfterAuthenticatedLoad();

    const request = http.expectOne('/me/login-context');
    expect(request.request.body).toEqual({ latitude: 37.42291, longitude: -122.08411, accuracy: 18 });
    request.flush({ message: 'Login location updated', data: { updated: true }, success: true });
  });

  it('silently ignores denied location access', () => {
    getCurrentPosition.mockImplementation((_success: PositionCallback, error: PositionErrorCallback) => {
      error({ code: 1, message: 'denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    });
    service.markPending();
    service.captureAfterAuthenticatedLoad();
    http.expectNone('/me/login-context');
  });
});
