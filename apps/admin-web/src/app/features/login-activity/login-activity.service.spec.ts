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

  it('requests all-user activity with the admin query contract', () => {
    service.list({ page: 1, limit: 20, q: 'Ada', sortBy: 'userEmail', sortDir: 'desc' }).subscribe();
    const request = http.expectOne('/admin/login-activity?page=1&limit=20&sortBy=userEmail&sortDir=desc&q=Ada');
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
  });
});
