import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EmbedSessionService } from './embed-session.service';
import { embedSessionInterceptor } from './embed-session.interceptor';
import { withCredentialsInterceptor } from './with-credentials.interceptor';

const token = `slpe_${'c'.repeat(43)}`;

describe('embedSessionInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let embed: EmbedSessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withFetch(), withInterceptors([embedSessionInterceptor, withCredentialsInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    embed = TestBed.inject(EmbedSessionService);
    embed.enableMode();
    embed.state.set('ready');
    embed.session.set({ token, projectId: 'project-1', scopes: ['templates:read'], theme: null, expiresAt: new Date(Date.now() + 60_000).toISOString(), parentOrigin: 'https://host.example' });
  });

  afterEach(() => http.verify());

  it('attaches the bearer session without sending cookies', () => {
    client.get('/projects/project-1/templates').subscribe();
    const request = http.expectOne('/projects/project-1/templates');
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    expect(request.request.withCredentials).toBe(false);
    expect(request.request.credentials).toBe('omit');
    request.flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
  });

  it('shows the in-frame expired state after an API 401', () => {
    client.get('/projects/project-1/templates').subscribe({ error: () => undefined });
    http.expectOne('/projects/project-1/templates').flush({ error: { code: 'UNAUTHENTICATED', message: 'expired' } }, { status: 401, statusText: 'Unauthorized' });
    expect(embed.state()).toBe('expired');
    expect(embed.session()).toBeNull();
  });
});
