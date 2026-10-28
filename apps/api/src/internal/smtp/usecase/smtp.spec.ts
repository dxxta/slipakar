import { describe, expect, it, vi } from 'vitest';
import type { Prisma, PrismaClient, SmtpConnection } from '@prisma/client';
import type { CryptoServiceInterface } from '../../../services/crypto.js';
import type { SmtpRepositoryInterface, SmtpSenderInterface } from '../../../domain/smtp/interface.js';
import { buildSmtpUseCase } from './smtp.js';

const mockSmtpConnection: SmtpConnection = {
  id: 'smtp-1',
  projectId: 'proj-1',
  host: 'smtp.example.com',
  port: 587,
  username: 'user@example.com',
  passwordEncrypted: 'enc:secret123',
  secure: false,
  fromAddress: 'sender@example.com',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeCrypto: CryptoServiceInterface = {
  encrypt: (text: string) => `enc:${text}`,
  decrypt: (cipher: string) => (cipher.startsWith('enc:') ? cipher.slice(4) : cipher),
};

const fakeTx = { __mockTx: true } as unknown as Prisma.TransactionClient;

const fakePrisma = {
  $transaction: async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => fn(fakeTx),
} as PrismaClient;

function makeFakeRepository(overrides: Partial<SmtpRepositoryInterface> = {}): SmtpRepositoryInterface {
  return {
    createSmtpRepository: vi.fn().mockResolvedValue({ data: mockSmtpConnection }),
    listSmtpRepository: vi.fn().mockResolvedValue({ data: [mockSmtpConnection] }),
    getSmtpRepository: vi.fn().mockResolvedValue({ data: mockSmtpConnection }),
    updateSmtpRepository: vi.fn().mockResolvedValue({ data: mockSmtpConnection }),
    deleteSmtpRepository: vi.fn().mockResolvedValue({ data: true }),
    ...overrides,
  };
}

describe('smtp usecase', () => {
  it('test 1: createSmtpUseCase stores passwordEncrypted that is not the plaintext and the returned data has no password and no passwordEncrypted key', async () => {
    const repository = makeFakeRepository();
    const useCase = buildSmtpUseCase({
      repository,
      prisma: fakePrisma,
      cryptoService: fakeCrypto,
      sender: { verify: vi.fn().mockResolvedValue({ ok: true }) },
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    const result = await useCase.createSmtpUseCase({
      projectId: 'proj-1',
      auditUserId: 'user-1',
      payload: {
        host: 'smtp.example.com',
        port: 587,
        username: 'user@example.com',
        password: 'plain-password',
        secure: false,
        fromAddress: 'sender@example.com',
      },
    });

    expect(repository.createSmtpRepository).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(repository.createSmtpRepository).mock.calls[0][0];
    expect(callArgs.payload.passwordEncrypted).toBe('enc:plain-password');
    expect(callArgs.payload.passwordEncrypted).not.toBe('plain-password');
    expect(callArgs.payload.fromAddress).toBe('sender@example.com');
    expect(result.data).not.toHaveProperty('password');
    expect(result.data).not.toHaveProperty('passwordEncrypted');
    expect(result.data.fromAddress).toBe('sender@example.com');
  });

  it('test 2: createSmtpUseCase with an invalid payload (port 0, empty host) rejects with AppError status 400 code VALIDATION and does not call the repository', async () => {
    const repository = makeFakeRepository();
    const useCase = buildSmtpUseCase({
      repository,
      prisma: fakePrisma,
      cryptoService: fakeCrypto,
      sender: { verify: vi.fn().mockResolvedValue({ ok: true }) },
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    await expect(
      useCase.createSmtpUseCase({
        projectId: 'proj-1',
        auditUserId: 'user-1',
        payload: {
          host: '',
          port: 0,
          username: 'user@example.com',
          password: 'secret',
          secure: false,
        },
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION',
    });

    expect(repository.createSmtpRepository).not.toHaveBeenCalled();
  });

  it('test 3: every method returns the envelope {message, data, success: true} with a non-empty message', async () => {
    const repository = makeFakeRepository();
    const sender: SmtpSenderInterface = { verify: vi.fn().mockResolvedValue({ ok: true }) };
    const useCase = buildSmtpUseCase({
      repository,
      prisma: fakePrisma,
      cryptoService: fakeCrypto,
      sender,
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    const createRes = await useCase.createSmtpUseCase({
      projectId: 'proj-1',
      auditUserId: 'user-1',
      payload: { host: 'smtp.example.com', port: 587, username: 'user@example.com', password: 'secret', secure: false, fromAddress: 'sender@example.com' },
    });
    expect(createRes.success).toBe(true);
    expect(typeof createRes.message).toBe('string');
    expect(createRes.message.trim().length).toBeGreaterThan(0);
    expect(createRes.data).toBeDefined();

    const listRes = await useCase.listSmtpUseCase({ projectId: 'proj-1', query: {}, auditUserId: 'user-1' });
    expect(listRes.success).toBe(true);
    expect(typeof listRes.message).toBe('string');
    expect(listRes.message.trim().length).toBeGreaterThan(0);
    expect(Array.isArray(listRes.data)).toBe(true);
    expect(listRes.metadata).toBeDefined();

    const getRes = await useCase.getSmtpUseCase({ projectId: 'proj-1', id: 'smtp-1', auditUserId: 'user-1' });
    expect(getRes.success).toBe(true);
    expect(typeof getRes.message).toBe('string');
    expect(getRes.message.trim().length).toBeGreaterThan(0);
    expect(getRes.data).toBeDefined();

    const updateRes = await useCase.updateSmtpUseCase({
      projectId: 'proj-1',
      id: 'smtp-1',
      auditUserId: 'user-1',
      payload: { host: 'smtp.new.com' },
    });
    expect(updateRes.success).toBe(true);
    expect(typeof updateRes.message).toBe('string');
    expect(updateRes.message.trim().length).toBeGreaterThan(0);
    expect(updateRes.data).toBeDefined();

    const deleteRes = await useCase.deleteSmtpUseCase({ projectId: 'proj-1', id: 'smtp-1', auditUserId: 'user-1' });
    expect(deleteRes.success).toBe(true);
    expect(typeof deleteRes.message).toBe('string');
    expect(deleteRes.message.trim().length).toBeGreaterThan(0);
    expect(deleteRes.data).toBeNull();

    const testRes = await useCase.testSmtpUseCase({ projectId: 'proj-1', id: 'smtp-1', auditUserId: 'user-1' });
    expect(testRes.success).toBe(true);
    expect(typeof testRes.message).toBe('string');
    expect(testRes.message.trim().length).toBeGreaterThan(0);
    expect(testRes.data).toBeDefined();
  });

  it('test 4: when projectLookup returns false every method rejects with AppError status 404 code NOT_FOUND and the repository is never called', async () => {
    const repository = makeFakeRepository();
    const sender: SmtpSenderInterface = { verify: vi.fn().mockResolvedValue({ ok: true }) };
    const projectLookup = vi.fn().mockResolvedValue(false);
    const useCase = buildSmtpUseCase({
      repository,
      prisma: fakePrisma,
      cryptoService: fakeCrypto,
      sender,
      projectLookup,
    });

    await expect(
      useCase.createSmtpUseCase({
        projectId: 'proj-1',
        auditUserId: 'user-1',
        payload: { host: 'smtp.example.com', port: 587, username: 'u', password: 'p', secure: false, fromAddress: 'u@example.com' },
      }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });

    await expect(
      useCase.listSmtpUseCase({ projectId: 'proj-1', auditUserId: 'user-1' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });

    await expect(
      useCase.getSmtpUseCase({ projectId: 'proj-1', id: 'smtp-1', auditUserId: 'user-1' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });

    await expect(
      useCase.updateSmtpUseCase({
        projectId: 'proj-1',
        id: 'smtp-1',
        auditUserId: 'user-1',
        payload: { host: 'smtp.new.com' },
      }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });

    await expect(
      useCase.deleteSmtpUseCase({ projectId: 'proj-1', id: 'smtp-1', auditUserId: 'user-1' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });

    await expect(
      useCase.testSmtpUseCase({ projectId: 'proj-1', id: 'smtp-1', auditUserId: 'user-1' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });

    expect(repository.createSmtpRepository).not.toHaveBeenCalled();
    expect(repository.listSmtpRepository).not.toHaveBeenCalled();
    expect(repository.getSmtpRepository).not.toHaveBeenCalled();
    expect(repository.updateSmtpRepository).not.toHaveBeenCalled();
    expect(repository.deleteSmtpRepository).not.toHaveBeenCalled();
    expect(sender.verify).not.toHaveBeenCalled();
  });

  it('test 5: updateSmtpUseCase with a new password re-encrypts it and with no password leaves passwordEncrypted out of the update payload', async () => {
    const repository = makeFakeRepository();
    const useCase = buildSmtpUseCase({
      repository,
      prisma: fakePrisma,
      cryptoService: fakeCrypto,
      sender: { verify: vi.fn().mockResolvedValue({ ok: true }) },
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    await useCase.updateSmtpUseCase({
      projectId: 'proj-1',
      id: 'smtp-1',
      auditUserId: 'user-1',
      payload: { password: 'new-secret' },
    });
    expect(repository.updateSmtpRepository).toHaveBeenCalledTimes(1);
    const callArgsWithPassword = vi.mocked(repository.updateSmtpRepository).mock.calls[0][0];
    expect(callArgsWithPassword.payload.passwordEncrypted).toBe('enc:new-secret');

    await useCase.updateSmtpUseCase({
      projectId: 'proj-1',
      id: 'smtp-1',
      auditUserId: 'user-1',
      payload: { host: 'smtp2.example.com' },
    });
    expect(repository.updateSmtpRepository).toHaveBeenCalledTimes(2);
    const callArgsWithoutPassword = vi.mocked(repository.updateSmtpRepository).mock.calls[1][0];
    expect(callArgsWithoutPassword.payload).toEqual({ host: 'smtp2.example.com' });
    expect(callArgsWithoutPassword.payload).not.toHaveProperty('passwordEncrypted');
  });

  it('test 6: updateSmtpUseCase with an empty object payload rejects with 400 VALIDATION', async () => {
    const repository = makeFakeRepository();
    const useCase = buildSmtpUseCase({
      repository,
      prisma: fakePrisma,
      cryptoService: fakeCrypto,
      sender: { verify: vi.fn().mockResolvedValue({ ok: true }) },
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    await expect(
      useCase.updateSmtpUseCase({
        projectId: 'proj-1',
        id: 'smtp-1',
        auditUserId: 'user-1',
        payload: {},
      }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION' });

    expect(repository.updateSmtpRepository).not.toHaveBeenCalled();
  });

  it('test 7: deleteSmtpUseCase returns success true and calls the repository delete once with auditUserId', async () => {
    const repository = makeFakeRepository();
    const useCase = buildSmtpUseCase({
      repository,
      prisma: fakePrisma,
      cryptoService: fakeCrypto,
      sender: { verify: vi.fn().mockResolvedValue({ ok: true }) },
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    const result = await useCase.deleteSmtpUseCase({
      projectId: 'proj-1',
      id: 'smtp-1',
      auditUserId: 'user-audit-id',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
    expect(repository.deleteSmtpRepository).toHaveBeenCalledTimes(1);
    expect(repository.deleteSmtpRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { projectId: 'proj-1', id: 'smtp-1' },
        auditUserId: 'user-audit-id',
      }),
    );
  });

  it('test 8: testSmtpUseCase decrypts the stored password, calls sender.verify and returns ok true when the fake sender resolves ok, and returns ok false with an error message that does not contain the password when it fails', async () => {
    const repository = makeFakeRepository({
      getSmtpRepository: vi.fn().mockResolvedValue({
        data: {
          ...mockSmtpConnection,
          passwordEncrypted: 'enc:my-stored-secret',
        },
      }),
    });
    const sender = {
      verify: vi.fn().mockResolvedValue({ ok: true }),
    };
    const useCase = buildSmtpUseCase({
      repository,
      prisma: fakePrisma,
      cryptoService: fakeCrypto,
      sender,
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    const successResult = await useCase.testSmtpUseCase({
      projectId: 'proj-1',
      id: 'smtp-1',
      auditUserId: 'user-1',
    });
    expect(sender.verify).toHaveBeenCalledWith({
      host: mockSmtpConnection.host,
      port: mockSmtpConnection.port,
      username: mockSmtpConnection.username,
      password: 'my-stored-secret',
      secure: mockSmtpConnection.secure,
      fromAddress: 'sender@example.com',
    });
    expect(successResult.data).toEqual({ ok: true });

    // When sender fails
    sender.verify = vi.fn().mockResolvedValue({ ok: false, error: 'Connection to host timed out' });
    const failResult = await useCase.testSmtpUseCase({
      projectId: 'proj-1',
      id: 'smtp-1',
      auditUserId: 'user-1',
    });
    expect(failResult.data).toMatchObject({ ok: false, error: expect.any(String) });
    expect(JSON.stringify(failResult)).not.toContain('my-stored-secret');
  });

  it('test 9: create, update and delete pass the same transaction client tx and auditUserId to the repository (assert the arguments)', async () => {
    const repository = makeFakeRepository();
    const useCase = buildSmtpUseCase({
      repository,
      prisma: fakePrisma,
      cryptoService: fakeCrypto,
      sender: { verify: vi.fn().mockResolvedValue({ ok: true }) },
      projectLookup: vi.fn().mockResolvedValue(true),
    });

    // 1. Create
    await useCase.createSmtpUseCase({
      projectId: 'proj-1',
      auditUserId: 'user-audit-1',
      payload: {
        host: 'smtp.example.com',
        port: 587,
        username: 'u',
        password: 'p',
        secure: false,
        fromAddress: 'u@example.com',
      },
    });
    expect(repository.createSmtpRepository).toHaveBeenCalledTimes(1);
    expect(repository.createSmtpRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj-1',
        auditUserId: 'user-audit-1',
        tx: fakeTx,
      }),
    );

    // 2. Update
    await useCase.updateSmtpUseCase({
      projectId: 'proj-1',
      id: 'smtp-1',
      auditUserId: 'user-audit-2',
      payload: {
        host: 'smtp.updated.com',
      },
    });
    expect(repository.updateSmtpRepository).toHaveBeenCalledTimes(1);
    expect(repository.updateSmtpRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { projectId: 'proj-1', id: 'smtp-1' },
        auditUserId: 'user-audit-2',
        tx: fakeTx,
      }),
    );

    // 3. Delete
    await useCase.deleteSmtpUseCase({
      projectId: 'proj-1',
      id: 'smtp-1',
      auditUserId: 'user-audit-3',
    });
    expect(repository.deleteSmtpRepository).toHaveBeenCalledTimes(1);
    expect(repository.deleteSmtpRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { projectId: 'proj-1', id: 'smtp-1' },
        auditUserId: 'user-audit-3',
        tx: fakeTx,
      }),
    );
  });
});
