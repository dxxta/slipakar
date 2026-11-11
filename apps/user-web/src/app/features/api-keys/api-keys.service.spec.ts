import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiKeysService } from './api-keys.service';

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ApiKeysService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists keys scoped to the selected project', async () => {
    const result = service.list('project-1');
    const request = http.expectOne('/projects/project-1/api-keys');
    expect(request.request.method).toBe('GET');
    request.flush({ message: 'ok', data: [], success: true });
    await expect(result).resolves.toEqual([]);
  });

  it('sends key creation fields and receives the one-time secret', () => {
    const result = service.create('project-1', { name: 'Payroll sync', scopes: ['templates:read'] });
    const request = http.expectOne('/projects/project-1/api-keys');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'Payroll sync', scopes: ['templates:read'] });
    request.flush({ message: 'ok', data: { id: 'abcdefgh', projectId: 'project-1', name: 'Payroll sync', prefix: 'abcdefgh', scopes: ['templates:read'], expiresAt: null, revokedAt: null, lastUsedAt: null, createdAt: '2026-11-11T00:00:00.000Z', secret: 'slp_abcdefgh_secret-once' }, success: true });
    return result.then((key) => expect(key.secret).toBe('slp_abcdefgh_secret-once'));
  });

  it('revokes a key by id under its project', () => {
    const result = service.revoke('project-1', 'key-1');
    const request = http.expectOne('/projects/project-1/api-keys/key-1');
    expect(request.request.method).toBe('DELETE');
    request.flush({ message: 'ok', data: { id: 'key-1', projectId: 'project-1' }, success: true });
    return result.then((key) => expect(key.id).toBe('key-1'));
  });
});
