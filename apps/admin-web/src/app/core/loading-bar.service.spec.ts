import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadingBarInterceptor } from './loading-bar.interceptor';
import { LoadingBarService } from './loading-bar.service';

describe('loading bar', () => {
  afterEach(() => vi.useRealTimers());

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([loadingBarInterceptor])), provideHttpClientTesting()],
    });
    return { bar: TestBed.inject(LoadingBarService), http: TestBed.inject(HttpClient), controller: TestBed.inject(HttpTestingController) };
  }

  it('runs while requests are in flight and turns green when all succeed, then goes idle', () => {
    vi.useFakeTimers();
    const { bar, http, controller } = setup();
    expect(bar.state()).toBe('idle');
    http.get('/a').subscribe();
    http.get('/b').subscribe();
    expect(bar.state()).toBe('loading');
    controller.expectOne('/a').flush({});
    expect(bar.state()).toBe('loading');
    controller.expectOne('/b').flush({});
    expect(bar.state()).toBe('success');
    vi.advanceTimersByTime(800);
    expect(bar.state()).toBe('idle');
  });

  it('turns red when a request fails', () => {
    const { bar, http, controller } = setup();
    http.get('/a').subscribe({ error: () => undefined });
    controller.expectOne('/a').flush('nope', { status: 500, statusText: 'Server Error' });
    expect(bar.state()).toBe('error');
  });

  it('turns red when a request is cancelled', () => {
    const { bar, http, controller } = setup();
    const subscription = http.get('/a').subscribe();
    subscription.unsubscribe();
    expect(bar.state()).toBe('error');
    expect(controller.expectOne('/a').cancelled).toBe(true);
  });
});
