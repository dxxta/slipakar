import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EmbedSessionService } from './embed-session.service';

const launchToken = `slpl_${'a'.repeat(43)}`;
const sessionToken = `slpe_${'b'.repeat(43)}`;

function setPath(path: string): void {
  window.history.replaceState(window.history.state, '', path);
}

describe('EmbedSessionService', () => {
  let http: HttpTestingController;
  let service: EmbedSessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    window.sessionStorage.removeItem('slipakar.embed-session');
    setPath('/');
  });

  it('exchanges a launch token without cookies, stores only the session, and removes the launch token from the URL', async () => {
    setPath(`/embed?token=${launchToken}`);
    service = TestBed.inject(EmbedSessionService);
    const initialized = service.initialize();
    const request = http.expectOne('/embed/exchange');
    expect(request.request.body).toEqual({ token: launchToken });
    expect(request.request.withCredentials).toBe(false);
    expect(request.request.credentials).toBe('omit');
    request.flush({ message: 'ok', data: { token: sessionToken, projectId: 'project-1', scopes: ['templates:read'], theme: { mode: 'dark', accent: '#D4F03C' }, expiresAt: new Date(Date.now() + 60_000).toISOString(), parentOrigin: 'https://host.example' }, success: true });
    await initialized;

    expect(service.state()).toBe('ready');
    expect(service.session()?.projectId).toBe('project-1');
    expect(window.location.search).toBe('');
    expect(window.sessionStorage.getItem('slipakar.embed-session')).toContain(sessionToken);
    http.expectNone('/me/preferences');
  });

  it('shows the disabled state when exchange reports embedding is off', async () => {
    setPath(`/embed?token=${launchToken}`);
    service = TestBed.inject(EmbedSessionService);
    const initialized = service.initialize();
    http.expectOne('/embed/exchange').flush({ error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404, statusText: 'Not Found' });
    await initialized;
    expect(service.state()).toBe('disabled');
    expect(service.session()).toBeNull();
  });

  it('restores an unexpired session from sessionStorage on reload', async () => {
    setPath('/embed/projects/project-1/templates');
    window.sessionStorage.setItem('slipakar.embed-session', JSON.stringify({ token: sessionToken, projectId: 'project-1', scopes: ['templates:read'], theme: null, expiresAt: new Date(Date.now() + 60_000).toISOString(), parentOrigin: 'https://host.example' }));
    service = TestBed.inject(EmbedSessionService);
    await service.initialize();
    expect(service.state()).toBe('ready');
    expect(service.hasScope('templates:read')).toBe(true);
    http.expectNone('/embed/exchange');
    http.expectNone('/me/preferences');
  });
});
