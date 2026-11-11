import geoip from 'geoip-lite';
import { validateAndThrow } from '../../../lib/validate-and-throw.js';
import { AppError } from '../../../lib/app-error.js';
import { parseUserAgent } from '../../../lib/user-agent-parser.js';
import { isPrivateIp, resolveProxyFlag } from '../../../lib/ip-utils.js';
import { maskEmail } from '../../../lib/mask-email.js';
import {
  listLoginActivityQueryDto,
  listAdminLoginActivityQueryDto,
  loginContextPayloadDto,
  type LoginEventView,
} from '../../../domain/login-activity/dto.js';
import type {
  LoginActivityRepositoryInterface,
  LoginActivityUseCaseInterface,
  LoginContextRateLimiterInterface,
  LoginContextUpdateStoreInterface,
} from '../../../domain/login-activity/interface.js';

export class LoginActivityUseCase implements LoginActivityUseCaseInterface {
  constructor(
    private readonly repository: LoginActivityRepositoryInterface,
    private readonly retentionDays: number = 90,
    private readonly loginContextRateLimiter?: LoginContextRateLimiterInterface,
    private readonly loginContextUpdateStore?: LoginContextUpdateStoreInterface,
  ) {}

  async getUserActivity(
    userId: string,
    query: unknown,
  ): Promise<{ data: LoginEventView[]; metadata: { page: number; limit: number; total: number } }> {
    const validated = validateAndThrow({
      schema: listLoginActivityQueryDto,
      data: query ?? {},
    });

    const result = await this.repository.findUserEvents(userId, validated);
    return {
      data: result.data,
      metadata: {
        page: validated.page,
        limit: validated.limit,
        total: result.total,
      },
    };
  }

  async getAdminActivity(
    query: unknown,
    adminUserId: string,
  ): Promise<{ data: LoginEventView[]; metadata: { page: number; limit: number; total: number } }> {
    const validated = validateAndThrow({
      schema: listAdminLoginActivityQueryDto,
      data: query ?? {},
    });

    const result = await this.repository.findAllEvents(validated);
    return {
      data: result.data.map((event) => event.userId === adminUserId || !event.userEmail
        ? event
        : { ...event, userEmail: maskEmail(event.userEmail) }),
      metadata: {
        page: validated.page,
        limit: validated.limit,
        total: result.total,
      },
    };
  }

  async recordLogin({
    userId,
    ipAddress,
    userAgent,
    forwardedFor,
  }: {
    userId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    forwardedFor?: string | string[] | null;
  }): Promise<LoginEventView> {
    const ua = parseUserAgent(userAgent);
    const proxy = resolveProxyFlag({ ip: ipAddress, forwardedFor });

    let country: string | null = null;
    let region: string | null = null;
    let city: string | null = null;
    let latitude: number | null = null;
    let longitude: number | null = null;

    if (ipAddress && !isPrivateIp(ipAddress)) {
      const geo = geoip.lookup(ipAddress);
      if (geo) {
        country = geo.country || null;
        region = geo.region || null;
        city = geo.city || null;
        if (geo.ll && geo.ll.length >= 2) {
          latitude = geo.ll[0];
          longitude = geo.ll[1];
        }
      }
    }

    return this.repository.create({
      userId,
      ipAddress,
      proxy,
      browser: ua.browser,
      os: ua.os,
      deviceType: ua.deviceType,
      country,
      region,
      city,
      latitude,
      longitude,
    });
  }

  async updateLoginContext(userId: string, payload: unknown): Promise<{ updated: boolean }> {
    const validated = validateAndThrow({ schema: loginContextPayloadDto, data: payload });
    if (!this.loginContextRateLimiter || !this.loginContextUpdateStore) {
      throw new AppError(503, 'LOGIN_CONTEXT_UNAVAILABLE', 'Login location updates are unavailable');
    }

    const limit = await this.loginContextRateLimiter.tryAcquire(`login-context:${userId}`, 10);
    if (!limit.allowed) {
      throw new AppError(429, 'RATE_LIMITED', 'Too many login location updates', { retryAfterMs: limit.retryAfterMs });
    }

    const createdAfter = new Date(Date.now() - 10 * 60 * 1000);
    const latest = await this.repository.findMostRecentEvent(userId, createdAfter);
    if (!latest) return { updated: false };

    const claimed = await this.loginContextUpdateStore.claim(userId, latest.id);
    if (!claimed) return { updated: false };

    try {
      const updated = await this.repository.updateEventCoordinates({
        id: latest.id,
        userId,
        createdAfter,
        latitude: Math.round(validated.latitude * 1000) / 1000,
        longitude: Math.round(validated.longitude * 1000) / 1000,
      });
      if (!updated) {
        try { await this.loginContextUpdateStore.release(userId, latest.id); } catch { /* The update result is authoritative. */ }
      }
      return { updated };
    } catch (error: unknown) {
      try { await this.loginContextUpdateStore.release(userId, latest.id); } catch { /* Preserve the database error. */ }
      throw error;
    }
  }

  async purgeExpired(): Promise<number> {
    return this.repository.purgeExpired(this.retentionDays);
  }
}
