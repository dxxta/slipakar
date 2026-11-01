import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  ListLoginActivityQueryDto,
  ListAdminLoginActivityQueryDto,
  LoginEventView,
} from '../../../domain/login-activity/dto.js';
import type {
  CreateLoginEventData,
  LoginActivityRepositoryInterface,
} from '../../../domain/login-activity/interface.js';

export class LoginActivityRepository implements LoginActivityRepositoryInterface {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateLoginEventData): Promise<LoginEventView> {
    const created = await this.prisma.loginEvent.create({
      data: {
        userId: data.userId,
        ipAddress: data.ipAddress ?? null,
        proxy: data.proxy,
        browser: data.browser ?? null,
        os: data.os ?? null,
        deviceType: data.deviceType ?? null,
        country: data.country ?? null,
        region: data.region ?? null,
        city: data.city ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      },
    });

    return {
      id: created.id,
      userId: created.userId,
      ip: created.ipAddress,
      proxy: created.proxy,
      browser: created.browser,
      os: created.os,
      deviceType: created.deviceType,
      country: created.country,
      region: created.region,
      city: created.city,
      latitude: created.latitude,
      longitude: created.longitude,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async findUserEvents(
    userId: string,
    query: ListLoginActivityQueryDto,
  ): Promise<{ data: LoginEventView[]; total: number }> {
    const where: Prisma.LoginEventWhereInput = {
      userId,
    };

    if (query.q) {
      where.OR = [
        { browser: { contains: query.q, mode: 'insensitive' } },
        { os: { contains: query.q, mode: 'insensitive' } },
        { country: { contains: query.q, mode: 'insensitive' } },
        { city: { contains: query.q, mode: 'insensitive' } },
        { ipAddress: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.LoginEventOrderByWithRelationInput = {
      [query.sortBy]: query.sortDir,
    };

    const [total, events] = await Promise.all([
      this.prisma.loginEvent.count({ where }),
      this.prisma.loginEvent.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      total,
      data: events.map((event) => ({
        id: event.id,
        userId: event.userId,
        ip: event.ipAddress,
        proxy: event.proxy,
        browser: event.browser,
        os: event.os,
        deviceType: event.deviceType,
        country: event.country,
        region: event.region,
        city: event.city,
        latitude: event.latitude,
        longitude: event.longitude,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }

  async findAllEvents(
    query: ListAdminLoginActivityQueryDto,
  ): Promise<{ data: LoginEventView[]; total: number }> {
    const where: Prisma.LoginEventWhereInput = {};

    if (query.q) {
      where.OR = [
        { ipAddress: { contains: query.q, mode: 'insensitive' } },
        { country: { contains: query.q, mode: 'insensitive' } },
        { city: { contains: query.q, mode: 'insensitive' } },
        { user: { email: { contains: query.q, mode: 'insensitive' } } },
        { user: { name: { contains: query.q, mode: 'insensitive' } } },
      ];
    }

    let orderBy: Prisma.LoginEventOrderByWithRelationInput;
    if (query.sortBy === 'userEmail') {
      orderBy = {
        user: {
          email: query.sortDir,
        },
      };
    } else {
      orderBy = {
        [query.sortBy]: query.sortDir,
      };
    }

    const [total, events] = await Promise.all([
      this.prisma.loginEvent.count({ where }),
      this.prisma.loginEvent.findMany({
        where,
        orderBy,
        include: {
          user: {
            select: {
              email: true,
              name: true,
            },
          },
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      total,
      data: events.map((event) => ({
        id: event.id,
        userId: event.userId,
        ip: event.ipAddress,
        proxy: event.proxy,
        browser: event.browser,
        os: event.os,
        deviceType: event.deviceType,
        country: event.country,
        region: event.region,
        city: event.city,
        latitude: event.latitude,
        longitude: event.longitude,
        createdAt: event.createdAt.toISOString(),
        userEmail: event.user.email,
        userName: event.user.name,
      })),
    };
  }

  async purgeExpired(retentionDays: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await this.prisma.loginEvent.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });
    return result.count;
  }
}
