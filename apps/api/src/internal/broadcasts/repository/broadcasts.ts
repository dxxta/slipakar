import { Prisma, type PrismaClient } from '@prisma/client';
import type {
  CreateBroadcastDto,
  UpdateBroadcastDto,
  ListBroadcastsQueryDto,
  BroadcastView,
  BroadcastCounts,
} from '../../../domain/broadcasts/dto.js';
import type {
  BroadcastRepositoryInterface,
  TargetRecipient,
} from '../../../domain/broadcasts/interface.js';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';

const deliveryChannelKey = '__slipakarDeliveryChannel';

function channelFromJson(value: unknown): 'app' | 'app_email' {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return 'app_email';
  const channel = (value as Record<string, unknown>)[deliveryChannelKey];
  return channel === 'app' ? 'app' : 'app_email';
}

function audienceFilterFromJson(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const filter = { ...(value as Record<string, unknown>) };
  delete filter[deliveryChannelKey];
  return Object.keys(filter).length > 0 ? filter : null;
}

function audienceFilterToJson(
  filter: Record<string, unknown> | undefined,
  channel: 'app' | 'app_email',
): Prisma.InputJsonValue {
  return { ...(filter ?? {}), [deliveryChannelKey]: channel } as Prisma.InputJsonValue;
}

export class BroadcastRepository implements BroadcastRepositoryInterface {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly auditRepository: AuditRepositoryInterface,
  ) {}

  private mapToView(row: {
    id: string;
    subject: string;
    bodyText: string;
    audience: string;
    audienceFilter: unknown;
    status: string;
    sentAt: Date | null;
    createdBy: string;
    counts: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): BroadcastView {
    const rawCounts = (row.counts as { total?: number; sent?: number; failed?: number; emailSkipped?: boolean }) ?? {};
    return {
      id: row.id,
      subject: row.subject,
      bodyText: row.bodyText,
      audience: row.audience,
      audienceFilter: audienceFilterFromJson(row.audienceFilter),
      channel: channelFromJson(row.audienceFilter),
      status: row.status,
      sentAt: row.sentAt ? row.sentAt.toISOString() : null,
      createdBy: row.createdBy,
      counts: {
        total: rawCounts.total ?? 0,
        sent: rawCounts.sent ?? 0,
        failed: rawCounts.failed ?? 0,
        ...(rawCounts.emailSkipped !== undefined && { emailSkipped: rawCounts.emailSkipped }),
      },
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async create(createdBy: string, data: CreateBroadcastDto): Promise<BroadcastView> {
    const row = await this.prisma.broadcast.create({
      data: {
        subject: data.subject,
        bodyText: data.bodyText,
        audience: data.audience,
        audienceFilter: audienceFilterToJson(data.audienceFilter, data.channel),
        createdBy,
        counts: { total: 0, sent: 0, failed: 0 },
      },
    });

    await this.auditRepository.createAuditRepository({
      entity: 'Broadcast',
      entityId: row.id,
      action: 'create',
      changes: [{ fieldName: 'broadcast', fieldValue: { subject: row.subject, audience: row.audience } }],
      auditUserId: createdBy,
    });

    return this.mapToView(row);
  }

  async findById(id: string): Promise<BroadcastView | null> {
    const row = await this.prisma.broadcast.findUnique({
      where: { id },
    });
    if (!row) return null;
    return this.mapToView(row);
  }

  async findMany(query: ListBroadcastsQueryDto): Promise<{ data: BroadcastView[]; total: number }> {
    const where: Prisma.BroadcastWhereInput = {};
    if (query.q) {
      where.OR = [
        { subject: { contains: query.q, mode: 'insensitive' } },
        { bodyText: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.broadcast.count({ where }),
      this.prisma.broadcast.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      total,
      data: rows.map((r) => this.mapToView(r)),
    };
  }

  async update(id: string, data: UpdateBroadcastDto): Promise<BroadcastView> {
    const existing = await this.prisma.broadcast.findUnique({
      where: { id },
      select: { audienceFilter: true },
    });
    const channel = data.channel ?? channelFromJson(existing?.audienceFilter);
    const audienceFilter = data.audience === 'all'
      ? undefined
      : data.audienceFilter ?? audienceFilterFromJson(existing?.audienceFilter) ?? undefined;
    const shouldStoreDeliverySettings = data.channel !== undefined || data.audienceFilter !== undefined || data.audience === 'all';
    const row = await this.prisma.broadcast.update({
      where: { id },
      data: {
        ...(data.subject !== undefined && { subject: data.subject }),
        ...(data.bodyText !== undefined && { bodyText: data.bodyText }),
        ...(data.audience !== undefined && { audience: data.audience }),
        ...(shouldStoreDeliverySettings && {
          audienceFilter: audienceFilterToJson(audienceFilter, channel),
        }),
      },
    });

    return this.mapToView(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.broadcast.delete({
      where: { id },
    });
  }

  async updateStatus(
    id: string,
    status: 'draft' | 'sent',
    sentAt: Date | null,
    counts: BroadcastCounts,
  ): Promise<BroadcastView> {
    const row = await this.prisma.broadcast.update({
      where: { id },
      data: {
        status,
        sentAt,
        counts: counts as unknown as Prisma.InputJsonValue,
      },
    });

    return this.mapToView(row);
  }

  async resolveRecipients(
    audience: string,
    audienceFilter?: Record<string, unknown> | null,
  ): Promise<TargetRecipient[]> {
    const where: Prisma.UserWhereInput = {
      disabledAt: null, // Always exclude disabled users
      role: { not: 'system' },
    };

    if (audience === 'role') {
      const role = audienceFilter?.role;
      if (typeof role !== 'string' || role.trim().length === 0) {
        return []; // Safety: never fall through to all users if role filter is invalid
      }
      where.role = role.trim();
      where.AND = [{ role: { not: 'system' } }];
    } else if (audience === 'users') {
      const userIds = audienceFilter?.userIds;
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return []; // Safety: never fall through to all users if userIds filter is invalid
      }
      where.id = { in: userIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0) };
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return users;
  }

  async createNoticesForBroadcast(
    broadcastId: string,
    recipients: TargetRecipient[],
    title: string,
    message: string,
  ): Promise<number> {
    if (recipients.length === 0) return 0;

    const data = recipients.map((r) => ({
      userId: r.id,
      broadcastId,
      title,
      message,
    }));

    const result = await this.prisma.userNotice.createMany({
      data,
    });

    return result.count;
  }
}
