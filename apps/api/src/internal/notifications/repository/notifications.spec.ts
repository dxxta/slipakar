import { describe, expect, it, vi } from 'vitest';
import type { Notification, PrismaClient } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';
import { buildNotificationsRepository } from './notifications.js';

describe('Notifications repository', () => {
  it('creates notification and audits', async () => {
    const record: Notification = {
      id: 'notif-1',
      projectId: 'proj-1',
      campaignId: 'camp-1',
      type: 'campaign_finished',
      message: 'Campaign finished: 10 sent, 0 failed',
      createdAt: new Date(),
      readAt: null,
    };
    const create = vi.fn().mockResolvedValue(record);
    const prisma = {
      notification: { create },
    } as unknown as PrismaClient;
    const auditRepository: AuditRepositoryInterface = {
      createAuditRepository: vi.fn().mockResolvedValue({ data: { count: 1 } }),
    };

    const repo = buildNotificationsRepository({ prisma, auditRepository });
    const res = await repo.createNotificationsRepository({
      payload: {
        projectId: 'proj-1',
        campaignId: 'camp-1',
        type: 'campaign_finished',
        message: 'Campaign finished: 10 sent, 0 failed',
      },
      auditUserId: 'system',
    });

    expect(res).toEqual({ data: record });
    expect(create).toHaveBeenCalledWith({
      data: {
        projectId: 'proj-1',
        campaignId: 'camp-1',
        type: 'campaign_finished',
        message: 'Campaign finished: 10 sent, 0 failed',
      },
    });
    expect(auditRepository.createAuditRepository).toHaveBeenCalledWith({
      entity: 'Notification',
      entityId: 'notif-1',
      action: 'create',
      auditUserId: 'system',
      tx: undefined,
      changes: [
        { fieldName: 'type', fieldValue: 'campaign_finished' },
        { fieldName: 'message', fieldValue: 'Campaign finished: 10 sent, 0 failed' },
      ],
    });
  });

  it('findAllNotificationsRepository returns paginated notifications ordered by createdAt desc', async () => {
    const record: Notification = {
      id: 'notif-1',
      projectId: 'proj-1',
      campaignId: 'camp-1',
      type: 'send_failed',
      message: 'Sending to row 1 failed',
      createdAt: new Date(),
      readAt: null,
    };
    const findMany = vi.fn().mockResolvedValue([record]);
    const count = vi.fn().mockResolvedValue(1);
    const prisma = {
      notification: { findMany, count },
    } as unknown as PrismaClient;
    const auditRepository: AuditRepositoryInterface = {
      createAuditRepository: vi.fn(),
    };

    const repo = buildNotificationsRepository({ prisma, auditRepository });
    const res = await repo.findAllNotificationsRepository({
      filter: { projectId: 'proj-1' },
      page: 1,
      limit: 10,
    });

    expect(res).toEqual({
      data: [record],
      metadata: { page: 1, limit: 10, total: 1 },
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { projectId: 'proj-1' },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 10,
    });
  });

  it('filters unread notifications when requested', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const repo = buildNotificationsRepository({
      prisma: { notification: { findMany, count } } as unknown as PrismaClient,
      auditRepository: { createAuditRepository: vi.fn() },
    });

    await repo.findAllNotificationsRepository({ filter: { projectId: 'proj-1', unread: true }, page: 1, limit: 20 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId: 'proj-1', readAt: null } }));
    expect(count).toHaveBeenCalledWith({ where: { projectId: 'proj-1', readAt: null } });
  });

  it('marks an unread notification read and audits the readAt field', async () => {
    const now = new Date('2026-11-09T10:00:00.000Z');
    const record: Notification = {
      id: 'notif-1', projectId: 'proj-1', campaignId: null, type: 'send_failed',
      message: 'Failed', createdAt: new Date('2026-11-09T09:00:00.000Z'), readAt: now,
    };
    const findFirst = vi.fn().mockResolvedValueOnce({ ...record, readAt: null }).mockResolvedValueOnce(record);
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const auditRepository: AuditRepositoryInterface = { createAuditRepository: vi.fn().mockResolvedValue({ data: { count: 1 } }) };
    const repo = buildNotificationsRepository({
      prisma: { notification: { findFirst, updateMany } } as unknown as PrismaClient,
      auditRepository,
    });

    const result = await repo.markReadNotificationsRepository({
      filter: { projectId: 'proj-1', id: 'notif-1' }, readAt: now, auditUserId: 'user-1',
    });

    expect(result.data).toEqual(record);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'notif-1', projectId: 'proj-1', readAt: null }, data: { readAt: now },
    });
    expect(auditRepository.createAuditRepository).toHaveBeenCalledWith({
      entity: 'Notification', entityId: 'notif-1', action: 'update', auditUserId: 'user-1', tx: undefined,
      changes: [{ fieldName: 'readAt', fieldValue: now.toISOString() }],
    });
  });

  it('does not change or audit an already read notification', async () => {
    const readAt = new Date('2026-11-08T08:00:00.000Z');
    const record: Notification = {
      id: 'notif-1', projectId: 'proj-1', campaignId: null, type: 'campaign_finished',
      message: 'Done', createdAt: new Date('2026-11-08T07:00:00.000Z'), readAt,
    };
    const updateMany = vi.fn();
    const auditRepository: AuditRepositoryInterface = { createAuditRepository: vi.fn() };
    const repo = buildNotificationsRepository({
      prisma: { notification: { findFirst: vi.fn().mockResolvedValue(record), updateMany } } as unknown as PrismaClient,
      auditRepository,
    });

    const result = await repo.markReadNotificationsRepository({
      filter: { projectId: 'proj-1', id: 'notif-1' }, readAt: new Date(), auditUserId: 'user-1',
    });

    expect(result.data).toEqual(record);
    expect(updateMany).not.toHaveBeenCalled();
    expect(auditRepository.createAuditRepository).not.toHaveBeenCalled();
  });

  it('counts unread notifications across only projects owned by the requested user', async () => {
    const count = vi.fn().mockResolvedValue(3);
    const repo = buildNotificationsRepository({
      prisma: { notification: { count } } as unknown as PrismaClient,
      auditRepository: { createAuditRepository: vi.fn() },
    });

    await expect(repo.countUnreadNotificationsRepository({ filter: { userId: 'user-1' } })).resolves.toEqual({ data: 3 });
    expect(count).toHaveBeenCalledWith({ where: { readAt: null, project: { ownerId: 'user-1' } } });
  });

  it('marks all currently unread rows read and audits each changed row', async () => {
    const now = new Date('2026-11-09T10:00:00.000Z');
    const findMany = vi.fn().mockResolvedValue([{ id: 'n-1' }, { id: 'n-2' }]);
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const createAuditRepository = vi.fn().mockResolvedValue({ data: { count: 1 } });
    const repo = buildNotificationsRepository({
      prisma: { notification: { findMany, updateMany } } as unknown as PrismaClient,
      auditRepository: { createAuditRepository },
    });

    await expect(repo.markAllReadNotificationsRepository({
      filter: { projectId: 'proj-1' }, readAt: now, auditUserId: 'user-1',
    })).resolves.toEqual({ data: 2 });
    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(createAuditRepository).toHaveBeenCalledTimes(2);
    expect(createAuditRepository).toHaveBeenCalledWith(expect.objectContaining({
      entity: 'Notification', action: 'update', auditUserId: 'user-1',
      changes: [{ fieldName: 'readAt', fieldValue: now.toISOString() }],
    }));
  });
});
