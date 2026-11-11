import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { EmbedSessionService } from './embed-session.service';

const fallbackSection = (embed: EmbedSessionService): string | null => {
  if (embed.hasScope('templates:read')) return 'templates';
  if (embed.hasScopes(['uploads:read', 'mappings:read'])) return 'data';
  if (embed.hasScope('campaigns:read')) return 'campaigns';
  return null;
};

export const embedEntryGuard: CanActivateFn = async () => {
  const embed = inject(EmbedSessionService);
  await embed.initialize();
  return true;
};

export const embedScopeGuard: CanActivateFn = (route) => {
  const embed = inject(EmbedSessionService);
  const router = inject(Router);
  if (embed.state() !== 'ready') return router.createUrlTree(['/embed']);
  const session = embed.session();
  const requestedProjectId = route.paramMap.get('projectId') ?? route.parent?.paramMap.get('projectId');
  const requiredScopes = route.data['embedScopes'];
  if (!session || typeof requestedProjectId !== 'string' || requestedProjectId !== session.projectId) return router.parseUrl('/embed');
  if (!Array.isArray(requiredScopes) || !requiredScopes.every((scope): scope is string => typeof scope === 'string')) return router.parseUrl('/embed');
  if (embed.hasScopes(requiredScopes)) return true;
  const fallback = fallbackSection(embed);
  return fallback ? router.parseUrl(`/embed/projects/${session.projectId}/${fallback}`) : router.parseUrl('/embed');
};

export const preventAuthRouteInEmbedGuard: CanActivateFn = () => {
  const embed = inject(EmbedSessionService);
  return embed.isEmbedMode() ? inject(Router).parseUrl('/embed') : true;
};

export const keepUnknownRouteInEmbedGuard: CanActivateFn = () => {
  const embed = inject(EmbedSessionService);
  return embed.isEmbedMode() ? inject(Router).parseUrl('/embed') : true;
};
