import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { Redis } from 'ioredis';
import { EMBED_SCOPES } from '../../../domain/embed/dto.js';
import { AppError } from '../../../lib/app-error.js';
import type { ApiKeysRepositoryInterface } from '../../../domain/apikeys/interface.js';
import { embedSessionKey, parseEmbedSession } from '../../embed/service/embed-token-service.js';
import type { RateLimiterInterface } from '../../sending/rate-limiter.js';

export const requiredScopeForApiKey = (method: string, path: string): string | null => {
  if (/^\/projects\/[^/]+\/embed-tokens$/.test(path)) return method === 'POST' ? 'embed:create' : null;
  if (path.startsWith('/projects/') && /\/pdf-templates(?:\/|$)/.test(path)) return method === 'GET' ? 'templates:read' : ['POST', 'PATCH', 'DELETE'].includes(method) ? 'templates:write' : null;
  if (/^\/projects\/[^/]+\/templates(?:\/|$)/.test(path)) return method === 'GET' ? 'templates:read' : ['POST', 'PATCH', 'DELETE'].includes(method) ? 'templates:write' : null;
  if (/^\/projects\/[^/]+\/uploads(?:\/|$)/.test(path)) return method === 'GET' ? 'uploads:read' : method === 'POST' || method === 'DELETE' ? 'uploads:write' : null;
  if (/^\/projects\/[^/]+\/attachments(?:\/|$)/.test(path)) return method === 'GET' ? 'uploads:read' : method === 'POST' || method === 'DELETE' ? 'uploads:write' : null;
  if (/^\/projects\/[^/]+\/mappings$/.test(path)) return method === 'GET' ? 'mappings:read' : method === 'PUT' ? 'mappings:write' : null;
  if (/^\/projects\/[^/]+\/campaigns\/[^/]+\/recipients$/.test(path)) return method === 'GET' ? 'recipients:read' : null;
  if (/^\/projects\/[^/]+\/campaigns\/[^/]+\/send$/.test(path)) return method === 'POST' ? 'campaigns:send' : null;
  if (/^\/projects\/[^/]+\/campaigns$/.test(path)) return method === 'GET' ? 'campaigns:read' : method === 'POST' ? 'campaigns:write' : null;
  if (/^\/projects\/[^/]+\/campaigns\/[^/]+$/.test(path)) return method === 'GET' ? 'campaigns:read' : null;
  if (/^\/projects\/[^/]+\/smtp$/.test(path)) return method === 'GET' ? 'smtp:read' : null;
  return null;
};

export function allowApiKey(scopes: string[], requiredScope: string, pathProjectId: string | undefined, keyProjectId: string): boolean {
  return Boolean(pathProjectId && pathProjectId === keyProjectId && scopes.includes(requiredScope));
}

function isActiveKey(key: Awaited<ReturnType<ApiKeysRepositoryInterface['findByPrefix']>>, expectedId: string, now: Date): key is NonNullable<typeof key> {
  return Boolean(key && key.id === expectedId && key.prefix === expectedId && !key.revokedAt && (!key.expiresAt || key.expiresAt > now));
}

function timingSafeHashMatches(token: string, storedHash: string | undefined): boolean {
  const actual = createHash('sha256').update(token).digest();
  const valid = /^[0-9a-f]{64}$/i.test(storedHash ?? '');
  const expected = Buffer.from(valid && storedHash ? storedHash : '0'.repeat(64), 'hex');
  const matches = timingSafeEqual(actual, expected);
  return Boolean(valid && matches);
}

export function createApiKeyMiddleware({ repository, isActive, isEmbedActive, rateLimiter, allowedOrigins, embedRedis, now = () => new Date() }: {
  repository: ApiKeysRepositoryInterface;
  isActive: () => Promise<boolean>;
  isEmbedActive?: () => Promise<boolean>;
  rateLimiter: RateLimiterInterface;
  allowedOrigins: string[];
  embedRedis?: Redis;
  now?: () => Date;
}): RequestHandler {
  const origins = new Set(allowedOrigins);
  return async (request, response, next): Promise<void> => {
    const origin = request.get('origin');
    const authorization = request.get('authorization');
    if (request.method === 'OPTIONS') {
      const requestedMethod = (request.get('access-control-request-method') ?? '').toUpperCase();
      if (origin && origins.has(origin) && requiredScopeForApiKey(requestedMethod, request.path) && await isActive()) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Vary', 'Origin');
        response.setHeader('Access-Control-Allow-Methods', requestedMethod);
        response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        response.status(204).end(); return;
      }
      next(); return;
    }
    if (authorization?.startsWith('Bearer slpe_')) {
      try {
        if (!embedRedis || !isEmbedActive || !(await isEmbedActive())) throw new AppError(401, 'UNAUTHENTICATED', 'Invalid embed session');
        const token = authorization.slice(7).trim();
        if (!/^slpe_[A-Za-z0-9_-]{43}$/.test(token)) throw new AppError(401, 'UNAUTHENTICATED', 'Invalid embed session');
        const session = parseEmbedSession(await embedRedis.get(embedSessionKey(token)));
        if (!session || new Date(session.expiresAt) <= now() || session.scopes.some((scope) => !EMBED_SCOPES.includes(scope as typeof EMBED_SCOPES[number]))) throw new AppError(401, 'UNAUTHENTICATED', 'Invalid embed session');
        const key = await repository.findByPrefix(session.keyId);
        if (!isActiveKey(key, session.keyId, now()) || key.projectId !== session.projectId || key.project.owner.disabledAt || session.scopes.some((scope) => !key.scopes.includes(scope))) {
          throw new AppError(401, 'UNAUTHENTICATED', 'Invalid embed session');
        }
        const path = request.path;
        const projectMatch = /^\/projects\/([^/]+)/.exec(path);
        const requiredScope = requiredScopeForApiKey(request.method, path);
        if (!requiredScope || !allowApiKey(session.scopes, requiredScope, projectMatch?.[1], session.projectId)) {
          throw new AppError(403, 'API_KEY_SCOPE_DENIED', 'Embed session is not authorized for this route');
        }
        const tokenHash = createHash('sha256').update(token).digest('hex');
        const limited = await rateLimiter.tryAcquire(`embed-session:${tokenHash}`, 120);
        if (!limited.allowed) {
          response.setHeader('Retry-After', String(Math.max(1, Math.ceil(limited.retryAfterMs / 1000))));
          throw new AppError(429, 'RATE_LIMITED', 'Embed session rate limit exceeded');
        }
        const owner = key.project.owner;
        request.apiKey = { id: key.id, projectId: session.projectId, scopes: session.scopes, embed: true, parentOrigin: session.parentOrigin, theme: session.theme };
        request.user = { id: owner.id, email: owner.email, role: owner.role, disabledAt: owner.disabledAt, disabledReason: owner.disabledReason };
        response.locals.userId = owner.id;
        await repository.touchApiKey(key.id, now());
        next();
      } catch (error) { next(error); }
      return;
    }
    if (!authorization?.startsWith('Bearer slp_')) { next(); return; }
    try {
      if (/^\/projects\/[^/]+\/embed-tokens$/.test(request.path) && (!isEmbedActive || !(await isEmbedActive()))) throw new AppError(404, 'NOT_FOUND', 'Resource not found');
      if (!(await isActive())) throw new AppError(401, 'UNAUTHENTICATED', 'Invalid API key');
      if (origin && !origins.has(origin)) throw new AppError(403, 'INVALID_ORIGIN', 'Origin is not allowed');
      if (origin) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Vary', 'Origin');
        response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        response.setHeader('Access-Control-Allow-Methods', request.method);
      }
      const token = authorization.slice(7).trim();
      const match = /^slp_([A-Za-z0-9_-]{8})_([A-Za-z0-9_-]{43})$/.exec(token);
      if (!match) throw new AppError(401, 'UNAUTHENTICATED', 'Invalid API key');
      const record = await repository.findByPrefix(match[1]);
      if (!record || record.prefix !== match[1] || !timingSafeHashMatches(token, record.keyHash) || record.revokedAt || (record.expiresAt && record.expiresAt <= now())) throw new AppError(401, 'UNAUTHENTICATED', 'Invalid API key');
      const path = request.path;
      const projectMatch = /^\/projects\/([^/]+)/.exec(path);
      const requiredScope = requiredScopeForApiKey(request.method, path);
      if (!requiredScope || !allowApiKey(record.scopes, requiredScope, projectMatch?.[1], record.projectId)) throw new AppError(403, 'API_KEY_SCOPE_DENIED', 'API key is not authorized for this route');
      const limited = await rateLimiter.tryAcquire(`api-key:${record.id}`, 120);
      if (!limited.allowed) {
        response.setHeader('Retry-After', String(Math.max(1, Math.ceil(limited.retryAfterMs / 1000))));
        throw new AppError(429, 'RATE_LIMITED', 'API key rate limit exceeded');
      }
      const owner = record.project.owner;
      if (owner.disabledAt) throw new AppError(403, 'ACCOUNT_DISABLED', 'Account is disabled');
      request.apiKey = { id: record.id, projectId: record.projectId, scopes: record.scopes };
      request.user = { id: owner.id, email: owner.email, role: owner.role, disabledAt: owner.disabledAt, disabledReason: owner.disabledReason };
      response.locals.userId = owner.id;
      await repository.touchApiKey(record.id, now());
      next();
    } catch (error) { next(error); }
  };
}
