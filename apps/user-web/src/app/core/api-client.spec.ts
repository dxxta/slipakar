import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from './api-client';
import { ApiError } from './api-error';

describe('ApiClient', () => {
  let client: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), ApiClient] });
    client = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('unwraps success envelopes for typed requests', async () => {
    const result = firstValueFrom(client.get<{ enabled: boolean }>('/admin/config'));
    const req = http.expectOne('/admin/config');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ success: true, message: 'ok', data: { enabled: true } });
    await expect(result).resolves.toEqual({ enabled: true });
  });

  it('unwraps paginated success envelopes with metadata via getPage', async () => {
    const result = firstValueFrom(client.getPage<{ id: string }>('/projects/p1/notifications'));
    const req = http.expectOne('/projects/p1/notifications');
    expect(req.request.withCredentials).toBe(true);
    req.flush({
      success: true,
      message: 'ok',
      data: [{ id: '1' }],
      metadata: { page: 1, limit: 20, total: 1 },
    });
    await expect(result).resolves.toEqual({
      data: [{ id: '1' }],
      metadata: { page: 1, limit: 20, total: 1 },
    });
  });

  it('maps an API error envelope to ApiError', async () => {
    const result = firstValueFrom(client.put('/admin/config/flags', { value: false }));
    const req = http.expectOne('/admin/config/flags');
    req.flush({ error: { code: 'FORBIDDEN', message: 'Admin only' } }, { status: 403, statusText: 'Forbidden' });
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'Admin only' });
  });
});
