import { convertToParamMap, provideRouter, Router, UrlTree } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { EmbedSessionService } from './embed-session.service';
import { embedScopeGuard } from './embed.guard';

const token = `slpe_${'b'.repeat(43)}`;

function activeSession(): EmbedSessionService {
  const embed = TestBed.inject(EmbedSessionService);
  embed.enableMode();
  embed.state.set('ready');
  embed.session.set({ token, projectId: 'project-1', scopes: ['templates:read', 'templates:write'], theme: null, expiresAt: new Date(Date.now() + 60_000).toISOString(), parentOrigin: 'https://host.example' });
  return embed;
}

describe('embedScopeGuard', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('allows routes when the embed session grants every required scope for its project', () => {
    activeSession();
    const result = TestBed.runInInjectionContext(() => embedScopeGuard({ paramMap: convertToParamMap({ projectId: 'project-1' }), data: { embedScopes: ['templates:read', 'templates:write'] } } as never, {} as never));
    expect(result).toBe(true);
  });

  it('routes a disallowed feature to an allowed section and rejects another project', () => {
    activeSession();
    const router = TestBed.inject(Router);
    const denied = TestBed.runInInjectionContext(() => embedScopeGuard({ paramMap: convertToParamMap({ projectId: 'project-1' }), data: { embedScopes: ['campaigns:send'] } } as never, {} as never));
    expect(denied).toBeInstanceOf(UrlTree);
    if (denied instanceof UrlTree) expect(router.serializeUrl(denied)).toBe('/embed/projects/project-1/templates');
    const wrongProject = TestBed.runInInjectionContext(() => embedScopeGuard({ paramMap: convertToParamMap({ projectId: 'project-2' }), data: { embedScopes: ['templates:read'] } } as never, {} as never));
    expect(wrongProject).toBeInstanceOf(UrlTree);
    if (wrongProject instanceof UrlTree) expect(router.serializeUrl(wrongProject)).toBe('/embed');
  });
});
