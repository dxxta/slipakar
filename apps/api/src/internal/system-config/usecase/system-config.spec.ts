import { describe, expect, it, vi } from 'vitest';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { FeatureFlagsInterface, SystemConfigRepositoryInterface } from '../../../domain/system-config/interface.js';
import { buildSystemConfigUseCase } from './system-config.js';

const fakeTx = {} as Prisma.TransactionClient;
const prisma = {
  $transaction: async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => fn(fakeTx),
} as PrismaClient;

describe('system-config usecase', () => {
  it('usecase validation rejects unknown keys and non-boolean values with 400 VALIDATION', async () => {
    const repository = {
      listSystemConfigRepository: vi.fn(),
      getSystemConfigRepository: vi.fn(),
      upsertSystemConfigRepository: vi.fn(),
    } as unknown as SystemConfigRepositoryInterface;
    const notifyChanged = vi.fn().mockResolvedValue(undefined);
    const flags = { isEnabled: vi.fn() } as unknown as FeatureFlagsInterface;

    const useCase = buildSystemConfigUseCase({
      repository,
      prisma,
      flags,
      notifyChanged,
    });

    // unknown key
    await expect(
      useCase.updateSystemConfigUseCase({
        key: 'unknown_key',
        payload: { value: true },
        auditUserId: 'admin-1',
      }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION' });

    // non-boolean value
    await expect(
      useCase.updateSystemConfigUseCase({
        key: 'scalar_docs',
        payload: { value: 'not-a-bool' },
        auditUserId: 'admin-1',
      }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION' });

    // missing payload
    await expect(
      useCase.updateSystemConfigUseCase({
        key: 'scalar_docs',
        payload: {},
        auditUserId: 'admin-1',
      }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION' });

    expect(repository.upsertSystemConfigRepository).not.toHaveBeenCalled();
    expect(notifyChanged).not.toHaveBeenCalled();
  });

  it('update returns envelope and calls notifyChanged once after commit', async () => {
    const callOrder: string[] = [];
    const upsertSpy = vi.fn().mockImplementation(async () => {
      callOrder.push('upsert');
      return { data: { id: 'cfg-1', key: 'scalar_docs', value: false } };
    });
    const repository = {
      upsertSystemConfigRepository: upsertSpy,
    } as unknown as SystemConfigRepositoryInterface;
    const notifyChanged = vi.fn().mockImplementation(async () => {
      callOrder.push('notifyChanged');
    });
    const flags = { isEnabled: vi.fn() } as unknown as FeatureFlagsInterface;

    const useCase = buildSystemConfigUseCase({
      repository,
      prisma,
      flags,
      notifyChanged,
    });

    const result = await useCase.updateSystemConfigUseCase({
      key: 'scalar_docs',
      payload: { value: false },
      auditUserId: 'admin-1',
    });

    expect(result).toEqual({
      message: 'System config updated successfully',
      data: { key: 'scalar_docs', value: false },
      success: true,
    });
    expect(repository.upsertSystemConfigRepository).toHaveBeenCalledWith({
      payload: { key: 'scalar_docs', value: false },
      auditUserId: 'admin-1',
      tx: fakeTx,
    });
    expect(notifyChanged).toHaveBeenCalledWith('scalar_docs');
    expect(callOrder).toEqual(['upsert', 'notifyChanged']);
  });

  it('getSystemConfigUseCase returns all flags with effective values (true when missing) as an array of {key, value}', async () => {
    const repository = {
      listSystemConfigRepository: vi.fn().mockResolvedValue({
        data: [
          { id: 'cfg-1', key: 'scalar_docs', value: false, createdAt: new Date(), updatedAt: new Date() },
        ],
      }),
    } as unknown as SystemConfigRepositoryInterface;
    const notifyChanged = vi.fn();
    const flags = { isEnabled: vi.fn() } as unknown as FeatureFlagsInterface;

    const useCase = buildSystemConfigUseCase({
      repository,
      prisma,
      flags,
      notifyChanged,
    });

    const result = await useCase.getSystemConfigUseCase({ auditUserId: 'admin-1' });

    expect(result).toEqual({
      message: 'System config retrieved successfully',
      data: [
        { key: 'scalar_docs', value: false },
        { key: 'pdf_builder', value: true },
        { key: 'self_signup', value: true },
        { key: 'api_access_enabled', value: false },
      ],
      success: true,
    });
  });
});
