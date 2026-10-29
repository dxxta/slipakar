import { describe, expect, it, vi } from 'vitest';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { NotificationsRepositoryInterface } from '../../../domain/notifications/interface.js';
import { buildNotificationsUseCase } from './notifications.js';

describe('Notifications usecase', () => {
  const fakeTx = {} as Prisma.TransactionClient;
  const prismaMock = {
    $transaction: async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => fn(fakeTx),
  } as unknown as PrismaClient;

  it('handleNotify persists a Notification row and logs structured line without emails', async () => {
    const repository = {
      createNotificationsRepository: vi.fn().mockResolvedValue({ data: { id: 'notif-1' } }),
      findAllNotificationsRepository: vi.fn(),
    } as unknown as NotificationsRepositoryInterface;

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const useCase = buildNotificationsUseCase({
      repository,
      prisma: prismaMock,
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    await useCase.handleNotify({
      type: 'send_failed',
      projectId: 'proj-1',
      campaignId: 'camp-1',
      message: 'Sending to row 1 failed',
    });

    expect(repository.createNotificationsRepository).toHaveBeenCalledWith({
      payload: {
        projectId: 'proj-1',
        campaignId: 'camp-1',
        type: 'send_failed',
        message: 'Sending to row 1 failed',
      },
      auditUserId: 'system',
      tx: fakeTx,
    });

    expect(logSpy).toHaveBeenCalled();
    const logCall = logSpy.mock.calls[0][0];
    expect(logCall).toContain('send_failed');
    expect(logCall).not.toContain('@');

    logSpy.mockRestore();
  });

  it('listNotificationsUseCase returns paginated notifications with metadata', async () => {
    const notif = {
      id: 'notif-1',
      projectId: 'proj-1',
      campaignId: 'camp-1',
      type: 'campaign_finished',
      message: 'Campaign finished: 5 sent, 0 failed',
      createdAt: new Date(),
      readAt: null,
    };
    const repository = {
      createNotificationsRepository: vi.fn(),
      findAllNotificationsRepository: vi.fn().mockResolvedValue({
        data: [notif],
        metadata: { page: 1, limit: 10, total: 1 },
      }),
    } as unknown as NotificationsRepositoryInterface;

    const useCase = buildNotificationsUseCase({
      repository,
      prisma: prismaMock,
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    const res = await useCase.listNotificationsUseCase({
      projectId: 'proj-1',
      query: { page: '1', limit: '10', unread: 'true' },
      auditUserId: 'user-1',
    });

    expect(res).toEqual({
      message: 'Notifications retrieved successfully',
      data: [{ ...notif, createdAt: notif.createdAt.toISOString() }],
      metadata: { page: 1, limit: 10, total: 1 },
      success: true,
    });
    expect(repository.findAllNotificationsRepository).toHaveBeenCalledWith({
      filter: { projectId: 'proj-1', unread: true }, page: 1, limit: 10,
      sortBy: 'createdAt', sortDir: 'desc',
    });
  });

  it('rejects invalid unread query values', async () => {
    const repository = {
      createNotificationsRepository: vi.fn(),
      findAllNotificationsRepository: vi.fn(),
    } as unknown as NotificationsRepositoryInterface;
    const useCase = buildNotificationsUseCase({
      repository,
      prisma: prismaMock,
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    await expect(useCase.listNotificationsUseCase({
      projectId: 'proj-1', query: { unread: 'sometimes' }, auditUserId: 'user-1',
    })).rejects.toMatchObject({ status: 400, code: 'VALIDATION' });
  });

  it('listNotificationsUseCase rejects 404 when projectLookup returns false', async () => {
    const repository = {
      createNotificationsRepository: vi.fn(),
      findAllNotificationsRepository: vi.fn(),
    } as unknown as NotificationsRepositoryInterface;

    const useCase = buildNotificationsUseCase({
      repository,
      prisma: prismaMock,
      projectLookup: vi.fn().mockResolvedValue(false),
    });

    await expect(
      useCase.listNotificationsUseCase({
        projectId: 'proj-1',
        query: { page: 1, limit: 10 },
        auditUserId: 'other-user',
      }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('marks a notification read and returns an ISO readAt view', async () => {
    const readAt = new Date('2026-11-09T10:00:00.000Z');
    const notification = {
      id: 'notif-1', projectId: 'proj-1', campaignId: null, type: 'campaign_finished',
      message: 'Finished', createdAt: new Date('2026-11-09T09:00:00.000Z'), readAt,
    };
    const repository = {
      createNotificationsRepository: vi.fn(),
      findAllNotificationsRepository: vi.fn(),
      markReadNotificationsRepository: vi.fn().mockResolvedValue({ data: notification }),
    } as unknown as NotificationsRepositoryInterface;
    const useCase = buildNotificationsUseCase({
      repository,
      prisma: prismaMock,
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    const result = await useCase.markReadNotificationUseCase({
      projectId: 'proj-1', id: 'notif-1', auditUserId: 'user-1',
    });

    expect(result.data.readAt).toBe('2026-11-09T10:00:00.000Z');
    expect(repository.markReadNotificationsRepository).toHaveBeenCalledWith({
      filter: { projectId: 'proj-1', id: 'notif-1' },
      readAt: expect.any(Date),
      auditUserId: 'user-1',
      tx: fakeTx,
    });
  });

  it('marks all unread notifications and returns the updated count', async () => {
    const repository = {
      createNotificationsRepository: vi.fn(),
      findAllNotificationsRepository: vi.fn(),
      markAllReadNotificationsRepository: vi.fn().mockResolvedValue({ data: 4 }),
    } as unknown as NotificationsRepositoryInterface;
    const useCase = buildNotificationsUseCase({
      repository,
      prisma: prismaMock,
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    const result = await useCase.markAllNotificationsReadUseCase({ projectId: 'proj-1', auditUserId: 'user-1' });

    expect(result).toEqual({ message: 'Notifications marked read successfully', data: { count: 4 }, success: true });
    expect(repository.markAllReadNotificationsRepository).toHaveBeenCalledWith({
      filter: { projectId: 'proj-1' }, readAt: expect.any(Date), auditUserId: 'user-1', tx: fakeTx,
    });
  });

  it('returns the unread total for the authenticated user across their projects', async () => {
    const repository = {
      createNotificationsRepository: vi.fn(),
      findAllNotificationsRepository: vi.fn(),
      countUnreadNotificationsRepository: vi.fn().mockResolvedValue({ data: 7 }),
    } as unknown as NotificationsRepositoryInterface;
    const useCase = buildNotificationsUseCase({
      repository,
      prisma: prismaMock,
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    const result = await useCase.getUnreadNotificationsCountUseCase({ auditUserId: 'user-1' });

    expect(result).toEqual({ message: 'Unread notifications count retrieved successfully', data: { count: 7 }, success: true });
    expect(repository.countUnreadNotificationsRepository).toHaveBeenCalledWith({ filter: { userId: 'user-1' } });
  });
});
