import { describe, expect, it, vi } from 'vitest';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../domain/audit/interface.js';
import type { StorageInterface } from '../../domain/storage/interface.js';
import { buildAttachmentStore } from './attachment-store.js';

describe('AttachmentStore', () => {
  const fakeAudit: AuditRepositoryInterface = {
    createAuditRepository: vi.fn().mockResolvedValue({ data: { count: 1 } }),
  };

  const fakeStorage: StorageInterface = {
    ensureBucket: vi.fn(),
    putObject: vi.fn().mockResolvedValue(undefined),
    getObject: vi.fn(),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    objectExists: vi.fn(),
  };

  it('storeAttachment stores attachment record and uploads to storage', async () => {
    const fakeTx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'p-1', storageQuotaBytes: 1000n }]),
      attachment: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { sizeBytes: 100n } }),
        create: vi.fn().mockResolvedValue({
          id: 'att-1',
          projectId: 'p-1',
          campaignId: 'c-1',
          fileName: 'doc.pdf',
          sizeBytes: 50n,
          kind: 'generated',
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
    } as unknown as Prisma.TransactionClient;

    const fakePrisma = {
      $transaction: async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => fn(fakeTx),
    } as PrismaClient;

    const store = buildAttachmentStore({
      prisma: fakePrisma,
      storage: fakeStorage,
      auditRepository: fakeAudit,
    });

    const res = await store.storeAttachment({
      projectId: 'p-1',
      campaignId: 'c-1',
      fileName: 'doc.pdf',
      buffer: Buffer.from('test pdf'),
      contentType: 'application/pdf',
      kind: 'generated',
      auditUserId: 'system',
    });

    expect(res).toMatchObject({
      id: 'att-1',
      projectId: 'p-1',
      campaignId: 'c-1',
      fileName: 'doc.pdf',
      kind: 'generated',
    });
    expect(fakeStorage.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        body: Buffer.from('test pdf'),
        contentType: 'application/pdf',
      }),
    );
  });

  it('storeAttachment rejects when quota exceeded', async () => {
    const fakeTx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'p-1', storageQuotaBytes: 100n }]),
      attachment: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { sizeBytes: 90n } }),
      },
    } as unknown as Prisma.TransactionClient;

    const fakePrisma = {
      $transaction: async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => fn(fakeTx),
    } as PrismaClient;

    const store = buildAttachmentStore({
      prisma: fakePrisma,
      storage: fakeStorage,
      auditRepository: fakeAudit,
    });

    await expect(
      store.storeAttachment({
        projectId: 'p-1',
        fileName: 'doc.pdf',
        buffer: Buffer.alloc(20), // 90 + 20 = 110 > 100
        contentType: 'application/pdf',
        kind: 'extra',
        auditUserId: 'user-1',
      }),
    ).rejects.toMatchObject({
      status: 413,
      code: 'STORAGE_QUOTA_EXCEEDED',
    });
  });

  it('removeAttachment deletes row and deletes object from storage', async () => {
    const fakeTx = {
      attachment: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'att-1',
          projectId: 'p-1',
          objectKey: 'p-1/uuid/doc.pdf',
          fileName: 'doc.pdf',
          sizeBytes: 10n,
          kind: 'extra',
        }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as Prisma.TransactionClient;

    const fakePrisma = {
      $transaction: async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => fn(fakeTx),
    } as PrismaClient;

    const store = buildAttachmentStore({
      prisma: fakePrisma,
      storage: fakeStorage,
      auditRepository: fakeAudit,
    });

    await store.removeAttachment({
      id: 'att-1',
      projectId: 'p-1',
      auditUserId: 'user-1',
    });

    expect(fakeStorage.deleteObject).toHaveBeenCalledWith('p-1/uuid/doc.pdf');
  });
});
