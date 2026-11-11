import geoip from 'geoip-lite';
import { validateAndThrow } from '../../../lib/validate-and-throw.js';
import { parseUserAgent } from '../../../lib/user-agent-parser.js';
import { isPrivateIp, resolveProxyFlag } from '../../../lib/ip-utils.js';
import { maskEmail } from '../../../lib/mask-email.js';
import {
  listLoginActivityQueryDto,
  listAdminLoginActivityQueryDto,
  type LoginEventView,
} from '../../../domain/login-activity/dto.js';
import type {
  LoginActivityRepositoryInterface,
  LoginActivityUseCaseInterface,
} from '../../../domain/login-activity/interface.js';

export class LoginActivityUseCase implements LoginActivityUseCaseInterface {
  constructor(
    private readonly repository: LoginActivityRepositoryInterface,
    private readonly retentionDays: number = 90,
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

  async purgeExpired(): Promise<number> {
    return this.repository.purgeExpired(this.retentionDays);
  }
}
