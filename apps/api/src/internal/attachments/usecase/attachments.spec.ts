import { describe, expect, it, vi } from 'vitest';
import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  AttachmentView,
  AttachmentsRepositoryInterface,
} from '../../../domain/attachments/interface.js';
import type { StorageInterface } from '../../../domain/storage/interface.js';
import { buildAttachmentsUseCase } from './attachments.js';

const mockAttachmentView: AttachmentView = {
  id: 'attach-1',
  projectId: 'proj-1',
  campaignId: null,
  fileName: 'document.pdf',
  sizeBytes: '100',
  kind: 'extra',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeTx = {
  $queryRaw: vi.fn().mockResolvedValue([{ id: 'proj-1' }]),
} as unknown as Prisma.TransactionClient;

const fakePrisma = {
  $transaction: async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => fn(fakeTx),
} as PrismaClient;

function makeFakeRepository(overrides: Partial<AttachmentsRepositoryInterface> = {}): AttachmentsRepositoryInterface {
  return {
    createAttachmentsRepository: vi.fn().mockResolvedValue({ data: mockAttachmentView }),
    findAllAttachmentsRepository: vi.fn().mockResolvedValue({ data: [mockAttachmentView] }),
    findByIdAttachmentsRepository: vi.fn().mockResolvedValue({ data: mockAttachmentView }),
    deleteAttachmentsRepository: vi.fn().mockResolvedValue({ data: true }),
    sumSizeAttachmentsRepository: vi.fn().mockResolvedValue(0n),
    ...overrides,
  };
}

function makeFakeStorage(overrides: Partial<StorageInterface> = {}): StorageInterface {
  return {
    ensureBucket: vi.fn().mockResolvedValue(undefined),
    putObject: vi.fn().mockResolvedValue(undefined),
    getObject: vi.fn().mockResolvedValue(Buffer.from('')),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    objectExists: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('attachments usecase', () => {
  it('quota exceeded writes nothing and never calls putObject', async () => {
    const repository = makeFakeRepository({
      sumSizeAttachmentsRepository: vi.fn().mockResolvedValue(900n),
    });
    const storage = makeFakeStorage();
    const quotaLookup = vi.fn().mockResolvedValue({ storageQuotaBytes: 1000n });
    const projectLookup = vi.fn().mockResolvedValue(true);

    const useCase = buildAttachmentsUseCase({
      repository,
      prisma: fakePrisma,
      storage,
      projectLookup,
      quotaLookup,
    });

    // 900 used + 200 new = 1100 > 1000 quota
    await expect(
      useCase.createAttachmentsUseCase({
        projectId: 'proj-1',
        auditUserId: 'user-1',
        file: {
          fileName: 'large.pdf',
          buffer: Buffer.alloc(200),
          contentType: 'application/pdf',
        },
        payload: { kind: 'extra' },
      }),
    ).rejects.toMatchObject({
      status: 413,
      code: 'STORAGE_QUOTA_EXCEEDED',
      message: 'Storage quota exceeded',
    });

    expect(repository.createAttachmentsRepository).not.toHaveBeenCalled();
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('success path order is row first then putObject', async () => {
    const callOrder: string[] = [];
    const repository = makeFakeRepository({
      createAttachmentsRepository: vi.fn().mockImplementation(async () => {
        callOrder.push('repository.create');
        return { data: mockAttachmentView };
      }),
    });
    const storage = makeFakeStorage({
      putObject: vi.fn().mockImplementation(async () => {
        callOrder.push('storage.putObject');
      }),
    });
    const quotaLookup = vi.fn().mockResolvedValue({ storageQuotaBytes: 1000n });
    const projectLookup = vi.fn().mockResolvedValue(true);

    const useCase = buildAttachmentsUseCase({
      repository,
      prisma: fakePrisma,
      storage,
      projectLookup,
      quotaLookup,
    });

    const result = await useCase.createAttachmentsUseCase({
      projectId: 'proj-1',
      auditUserId: 'user-1',
      file: {
        fileName: 'doc.pdf',
        buffer: Buffer.alloc(50),
        contentType: 'application/pdf',
      },
      payload: { kind: 'extra' },
    });

    expect(callOrder).toEqual(['repository.create', 'storage.putObject']);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockAttachmentView);
  });

  it('putObject failure removes the row (compensation) and rethrows', async () => {
    const repository = makeFakeRepository({
      createAttachmentsRepository: vi.fn().mockResolvedValue({ data: mockAttachmentView }),
      deleteAttachmentsRepository: vi.fn().mockResolvedValue({ data: true }),
    });
    const storage = makeFakeStorage({
      putObject: vi.fn().mockRejectedValue(new Error('MinIO connection refused')),
    });
    const quotaLookup = vi.fn().mockResolvedValue({ storageQuotaBytes: 1000n });
    const projectLookup = vi.fn().mockResolvedValue(true);

    const useCase = buildAttachmentsUseCase({
      repository,
      prisma: fakePrisma,
      storage,
      projectLookup,
      quotaLookup,
    });

    await expect(
      useCase.createAttachmentsUseCase({
        projectId: 'proj-1',
        auditUserId: 'user-1',
        file: {
          fileName: 'doc.pdf',
          buffer: Buffer.alloc(50),
          contentType: 'application/pdf',
        },
        payload: { kind: 'extra' },
      }),
    ).rejects.toThrow('MinIO connection refused');

    expect(repository.createAttachmentsRepository).toHaveBeenCalledTimes(1);
    expect(repository.deleteAttachmentsRepository).toHaveBeenCalledTimes(1);
    expect(repository.deleteAttachmentsRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { projectId: 'proj-1', id: mockAttachmentView.id },
        auditUserId: 'user-1',
      }),
    );
  });

  it('sanitize cases like ../../etc/passwd and long file names', async () => {
    let capturedObjectKey = '';
    let capturedFileName = '';
    const repository = makeFakeRepository({
      createAttachmentsRepository: vi.fn().mockImplementation(async ({ payload }) => {
        capturedObjectKey = payload.objectKey;
        capturedFileName = payload.fileName;
        return { data: { ...mockAttachmentView, fileName: payload.fileName } };
      }),
    });
    const storage = makeFakeStorage();
    const quotaLookup = vi.fn().mockResolvedValue({ storageQuotaBytes: 10000n });
    const projectLookup = vi.fn().mockResolvedValue(true);

    const useCase = buildAttachmentsUseCase({
      repository,
      prisma: fakePrisma,
      storage,
      projectLookup,
      quotaLookup,
    });

    // 1. Path traversal & special characters
    await useCase.createAttachmentsUseCase({
      projectId: 'proj-1',
      auditUserId: 'user-1',
      file: {
        fileName: '../../etc/passwd',
        buffer: Buffer.alloc(10),
        contentType: 'text/plain',
      },
      payload: { kind: 'extra' },
    });

    expect(capturedFileName).toBe('passwd');
    expect(capturedObjectKey).toMatch(/^proj-1\/[0-9a-f-]+\/passwd$/);

    // 2. Empty or only special characters
    await useCase.createAttachmentsUseCase({
      projectId: 'proj-1',
      auditUserId: 'user-1',
      file: {
        fileName: '////',
        buffer: Buffer.alloc(10),
        contentType: 'text/plain',
      },
      payload: { kind: 'extra' },
    });
    expect(capturedFileName).toBe('file');
    expect(capturedObjectKey).toMatch(/^proj-1\/[0-9a-f-]+\/file$/);

    // 3. Characters outside letters digits dot dash underscore replaced with underscore, truncated to 100 chars
    const longName = 'a'.repeat(120) + '@#$' + '.pdf';
    await useCase.createAttachmentsUseCase({
      projectId: 'proj-1',
      auditUserId: 'user-1',
      file: {
        fileName: longName,
        buffer: Buffer.alloc(10),
        contentType: 'application/pdf',
      },
      payload: { kind: 'extra' },
    });
    expect(capturedFileName.length).toBeLessThanOrEqual(100);
    expect(capturedFileName).not.toContain('@');
    expect(capturedFileName).not.toContain('#');
    expect(capturedFileName).not.toContain('$');
  });

  it('views have no objectKey in returned data', async () => {
    const repository = makeFakeRepository();
    const storage = makeFakeStorage();
    const quotaLookup = vi.fn().mockResolvedValue({ storageQuotaBytes: 1000n });
    const projectLookup = vi.fn().mockResolvedValue(true);

    const useCase = buildAttachmentsUseCase({
      repository,
      prisma: fakePrisma,
      storage,
      projectLookup,
      quotaLookup,
    });

    const createRes = await useCase.createAttachmentsUseCase({
      projectId: 'proj-1',
      auditUserId: 'user-1',
      file: {
        fileName: 'doc.pdf',
        buffer: Buffer.alloc(50),
        contentType: 'application/pdf',
      },
      payload: { kind: 'extra' },
    });
    expect(createRes.data).not.toHaveProperty('objectKey');

    const listRes = await useCase.findAllAttachmentsUseCase({ projectId: 'proj-1', auditUserId: 'user-1' });
    expect(listRes.data[0]).not.toHaveProperty('objectKey');

    const getRes = await useCase.findByIdAttachmentsUseCase({ projectId: 'proj-1', id: 'attach-1', auditUserId: 'user-1' });
    expect(getRes.data).not.toHaveProperty('objectKey');
  });

  it('another users project gives 404 for all usecases and repository is not called', async () => {
    const repository = makeFakeRepository();
    const storage = makeFakeStorage();
    const quotaLookup = vi.fn().mockResolvedValue(null);
    const projectLookup = vi.fn().mockResolvedValue(false);

    const useCase = buildAttachmentsUseCase({
      repository,
      prisma: fakePrisma,
      storage,
      projectLookup,
      quotaLookup,
    });

    await expect(
      useCase.createAttachmentsUseCase({
        projectId: 'proj-1',
        auditUserId: 'other-user',
        file: { fileName: 'doc.pdf', buffer: Buffer.alloc(50), contentType: 'application/pdf' },
        payload: { kind: 'extra' },
      }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });

    await expect(
      useCase.findAllAttachmentsUseCase({ projectId: 'proj-1', auditUserId: 'other-user' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });

    await expect(
      useCase.findByIdAttachmentsUseCase({ projectId: 'proj-1', id: 'attach-1', auditUserId: 'other-user' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });

    await expect(
      useCase.deleteAttachmentsUseCase({ projectId: 'proj-1', id: 'attach-1', auditUserId: 'other-user' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });

    await expect(
      useCase.getStorageUsageUseCase({ projectId: 'proj-1', auditUserId: 'other-user' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });

    expect(repository.createAttachmentsRepository).not.toHaveBeenCalled();
    expect(repository.findAllAttachmentsRepository).not.toHaveBeenCalled();
    expect(repository.findByIdAttachmentsRepository).not.toHaveBeenCalled();
    expect(repository.deleteAttachmentsRepository).not.toHaveBeenCalled();
  });

  it('delete usecase deletes row in transaction with audit then calls storage.deleteObject with stored objectKey and returned data has no objectKey', async () => {
    const callOrder: string[] = [];
    const repository = makeFakeRepository({
      findByIdAttachmentsRepository: vi.fn().mockResolvedValue({
        data: {
          id: 'attach-1',
          projectId: 'proj-1',
          campaignId: null,
          fileName: 'document.pdf',
          sizeBytes: 100n,
          kind: 'extra',
          objectKey: 'proj-1/uuid/doc.pdf',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
      deleteAttachmentsRepository: vi.fn().mockImplementation(async () => {
        callOrder.push('repository.delete');
        return { data: true };
      }),
    });
    const storage = makeFakeStorage({
      deleteObject: vi.fn().mockImplementation(async () => {
        callOrder.push('storage.deleteObject');
      }),
    });
    const quotaLookup = vi.fn().mockResolvedValue({ storageQuotaBytes: 1000n });
    const projectLookup = vi.fn().mockResolvedValue(true);

    const useCase = buildAttachmentsUseCase({
      repository,
      prisma: fakePrisma,
      storage,
      projectLookup,
      quotaLookup,
    });

    const result = await useCase.deleteAttachmentsUseCase({
      projectId: 'proj-1',
      id: 'attach-1',
      auditUserId: 'user-1',
    });

    expect(callOrder).toEqual(['repository.delete', 'storage.deleteObject']);
    expect(storage.deleteObject).toHaveBeenCalledWith('proj-1/uuid/doc.pdf');
    expect(result).toEqual({ message: 'Attachment deleted successfully', data: null, success: true });
    expect(result.data).toBeNull();
    expect(result).not.toHaveProperty('objectKey');
    expect(repository.deleteAttachmentsRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { projectId: 'proj-1', id: 'attach-1' },
        auditUserId: 'user-1',
        tx: fakeTx,
      }),
    );
  });

  it('getStorageUsageUseCase returns usedBytes and quotaBytes as decimal strings', async () => {
    const repository = makeFakeRepository({
      sumSizeAttachmentsRepository: vi.fn().mockResolvedValue(12345n),
    });
    const storage = makeFakeStorage();
    const quotaLookup = vi.fn().mockResolvedValue({ storageQuotaBytes: 1073741824n });
    const projectLookup = vi.fn().mockResolvedValue(true);

    const useCase = buildAttachmentsUseCase({
      repository,
      prisma: fakePrisma,
      storage,
      projectLookup,
      quotaLookup,
    });

    const result = await useCase.getStorageUsageUseCase({
      projectId: 'proj-1',
      auditUserId: 'user-1',
    });

    expect(result).toEqual({
      message: 'Storage usage retrieved successfully',
      data: {
        usedBytes: '12345',
        quotaBytes: '1073741824',
      },
      success: true,
    });
  });
});
