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

  it('maps an API error envelope to ApiError', async () => {
    const result = firstValueFrom(client.put('/admin/config/flags', { value: false }));
    const req = http.expectOne('/admin/config/flags');
    req.flush({ error: { code: 'FORBIDDEN', message: 'Admin only' } }, { status: 403, statusText: 'Forbidden' });
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'Admin only' });
  });

  it('unwraps a PATCH success envelope', async () => {
    const result = firstValueFrom(client.patch<{ themeMode: string }, { themeMode: string }>('/me/preferences', { themeMode: 'dark' }));
    const req = http.expectOne('/me/preferences');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ success: true, message: 'saved', data: { themeMode: 'dark' } });
    await expect(result).resolves.toEqual({ themeMode: 'dark' });
  });

  it('unwraps a DELETE success envelope', async () => {
    const result = firstValueFrom(client.delete<null>('/admin/broadcasts/b1'));
    const req = http.expectOne('/admin/broadcasts/b1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, message: 'deleted', data: null });
    await expect(result).resolves.toBeNull();
  });

  it('unwraps paginated envelopes into data and metadata', async () => {
    const result = firstValueFrom(client.getPage<{ id: string }>('/admin/broadcasts?page=1&limit=20'));
    const req = http.expectOne('/admin/broadcasts?page=1&limit=20');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ success: true, message: 'ok', data: [{ id: 'b1' }], metadata: { page: 1, limit: 20, total: 1 } });
    await expect(result).resolves.toEqual({ data: [{ id: 'b1' }], metadata: { page: 1, limit: 20, total: 1 } });
  });
});
