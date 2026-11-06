import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LoginActivityService } from './login-activity.service';

describe('LoginActivityService', () => {
  let service: LoginActivityService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LoginActivityService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests the signed-in user activity with validated list query fields', () => {
    service.list({ page: 2, limit: 10, q: 'Firefox', sortBy: 'browser', sortDir: 'asc' }).subscribe();
    const request = http.expectOne('/me/login-activity?page=2&limit=10&sortBy=browser&sortDir=asc&q=Firefox');
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ message: 'ok', data: [], metadata: { page: 2, limit: 10, total: 0 }, success: true });
  });
});
