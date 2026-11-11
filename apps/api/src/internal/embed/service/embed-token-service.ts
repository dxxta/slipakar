import { createHash, randomBytes } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { ApiKeysRepositoryInterface } from '../../../domain/apikeys/interface.js';
import { EMBED_SCOPES, createEmbedTokenDto, embedThemeDto, exchangeEmbedTokenDto, type EmbedScope, type EmbedTheme } from '../../../domain/embed/dto.js';
import type { EmbedSessionView, EmbedUseCaseInterface } from '../../../domain/embed/interface.js';
import type { RateLimiterInterface } from '../../sending/rate-limiter.js';
import { AppError } from '../../../lib/app-error.js';
import { validateAndThrow } from '../../../lib/validate-and-throw.js';

const launchTtlSeconds = 300;
const sessionTtlSeconds = 3600;
const launchKey = (token: string): string => `embed:launch:${createHash('sha256').update(token).digest('hex')}`;
export const embedSessionKey = (token: string): string => `embed:session:${createHash('sha256').update(token).digest('hex')}`;
const consumeScript = "local value = redis.call('GET', KEYS[1]); if value then redis.call('DEL', KEYS[1]); end; return value";

export type EmbedLaunchRecord = {
  projectId: string;
  scopes: EmbedScope[];
  parentOrigin: string;
  theme: EmbedTheme | null;
  keyId: string;
  createdAt: number;
};
export type EmbedSessionRecord = EmbedLaunchRecord & { expiresAt: string };

function isCurrentKeyValid(key: Awaited<ReturnType<ApiKeysRepositoryInterface['findByPrefix']>>, keyId: string, now: Date): key is NonNullable<typeof key> {
  return Boolean(key && key.id === keyId && key.prefix === keyId && !key.revokedAt && (!key.expiresAt || key.expiresAt > now) && !key.project.owner.disabledAt);
}

export function buildEmbedTokenService({ redis, keyRepository, rateLimiter, isActive, allowedOrigins, publicBaseUrl, now = () => new Date() }: {
  redis: Redis;
  keyRepository: ApiKeysRepositoryInterface;
  rateLimiter: RateLimiterInterface;
  isActive: () => Promise<boolean>;
  allowedOrigins: string[];
  publicBaseUrl: string;
  now?: () => Date;
}): EmbedUseCaseInterface {
  const origins = new Set(allowedOrigins);
  const assertActive = async (): Promise<void> => {
    if (!origins.size || !(await isActive())) throw new AppError(404, 'NOT_FOUND', 'Resource not found');
  };

  return {
    async mint({ projectId, keyId, keyScopes, payload }) {
      await assertActive();
      const body = validateAndThrow({ schema: createEmbedTokenDto, data: payload });
      const parentOrigin = new URL(body.parentOrigin).origin;
      if (!origins.has(parentOrigin)) throw new AppError(400, 'INVALID_ORIGIN', 'parentOrigin is not allowed');
      const requestedScopes = body.scopes ?? EMBED_SCOPES.filter((scope) => keyScopes.includes(scope));
      if (!requestedScopes.length || requestedScopes.some((scope) => !keyScopes.includes(scope) || !EMBED_SCOPES.includes(scope))) {
        throw new AppError(400, 'VALIDATION', 'Embedding scopes must be a non-empty subset of the API key scopes');
      }
      const token = `slpl_${randomBytes(32).toString('base64url')}`;
      const createdAt = now();
      const expiresAt = new Date(createdAt.getTime() + launchTtlSeconds * 1000);
      const record: EmbedLaunchRecord = { projectId, scopes: requestedScopes, parentOrigin, theme: body.theme ?? null, keyId, createdAt: createdAt.getTime() };
      await redis.set(launchKey(token), JSON.stringify(record), 'EX', launchTtlSeconds, 'NX');
      const url = new URL('/embed', publicBaseUrl);
      url.searchParams.set('token', token);
      return { message: 'Embed launch token created successfully', data: { token, url: url.toString(), expiresAt: expiresAt.toISOString() }, success: true };
    },

    async exchange({ payload, ip }) {
      await assertActive();
      const body = validateAndThrow({ schema: exchangeEmbedTokenDto, data: payload });
      const limited = await rateLimiter.tryAcquire(`embed-exchange:${ip}`, 20);
      if (!limited.allowed) throw new AppError(429, 'RATE_LIMITED', 'Too many embed token exchanges');
      const rawRecord = await redis.eval(consumeScript, 1, launchKey(body.token));
      if (typeof rawRecord !== 'string') throw new AppError(404, 'NOT_FOUND', 'Embed launch token not found');
      let record: EmbedLaunchRecord;
      try { record = JSON.parse(rawRecord) as EmbedLaunchRecord; } catch { throw new AppError(404, 'NOT_FOUND', 'Embed launch token not found'); }
      if (!record || !record.projectId || !record.keyId || !origins.has(record.parentOrigin) || !Array.isArray(record.scopes) || !record.scopes.length || record.scopes.some((scope) => !EMBED_SCOPES.includes(scope))) throw new AppError(404, 'NOT_FOUND', 'Embed launch token not found');
      const key = await keyRepository.findByPrefix(record.keyId);
      if (!isCurrentKeyValid(key, record.keyId, now()) || key.projectId !== record.projectId || record.scopes.some((scope) => !key.scopes.includes(scope))) {
        throw new AppError(404, 'NOT_FOUND', 'Embed launch token not found');
      }
      const sessionToken = `slpe_${randomBytes(32).toString('base64url')}`;
      const expiresAt = new Date(now().getTime() + sessionTtlSeconds * 1000).toISOString();
      const session: EmbedSessionRecord = { ...record, expiresAt };
      await redis.set(embedSessionKey(sessionToken), JSON.stringify(session), 'EX', sessionTtlSeconds, 'NX');
      return { message: 'Embed session created successfully', data: { token: sessionToken, projectId: record.projectId, scopes: record.scopes, theme: record.theme, expiresAt, parentOrigin: record.parentOrigin }, success: true };
    },
  };
}

export function parseEmbedSession(value: string | null): EmbedSessionRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as EmbedSessionRecord;
    if (typeof parsed.projectId !== 'string' || !parsed.projectId || typeof parsed.keyId !== 'string' || !parsed.keyId) return null;
    if (!Number.isFinite(parsed.createdAt) || typeof parsed.expiresAt !== 'string' || !Number.isFinite(Date.parse(parsed.expiresAt))) return null;
    if (!Array.isArray(parsed.scopes) || !parsed.scopes.length || parsed.scopes.some((scope) => !EMBED_SCOPES.includes(scope))) return null;
    if (typeof parsed.parentOrigin !== 'string') return null;
    const parentOrigin = new URL(parsed.parentOrigin);
    if (parentOrigin.origin !== parsed.parentOrigin || !['https:', 'http:'].includes(parentOrigin.protocol) || (parentOrigin.protocol === 'http:' && parentOrigin.hostname !== 'localhost')) return null;
    if (parsed.theme !== null && !embedThemeDto.safeParse(parsed.theme).success) return null;
    return parsed;
  } catch { return null; }
}

