import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient, SystemConfig } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';
import { buildSystemConfigRepository } from './system-config.js';

describe('SystemConfig repository', () => {
  it('upserts config and logs audit with fieldName value', async () => {
    const record: SystemConfig = {
      id: 'cfg-1',
      key: 'scalar_docs',
      value: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const upsert = vi.fn().mockResolvedValue(record);
    const prisma = {
      systemConfig: {
        upsert,
      },
    } as unknown as PrismaClient;
    const auditRepository: AuditRepositoryInterface = {
      createAuditRepository: vi.fn().mockResolvedValue({ data: { count: 1 } }),
    };

    const repo = buildSystemConfigRepository({ prisma, auditRepository });
    const result = await repo.upsertSystemConfigRepository({
      payload: { key: 'scalar_docs', value: false },
      auditUserId: 'admin-1',
    });

    expect(result).toEqual({ data: record });
    expect(upsert).toHaveBeenCalledWith({
      where: { key: 'scalar_docs' },
      update: { value: false },
      create: { key: 'scalar_docs', value: false },
    });
    expect(auditRepository.createAuditRepository).toHaveBeenCalledWith({
      entity: 'SystemConfig',
      entityId: record.id,
      action: 'update',
      auditUserId: 'admin-1',
      tx: undefined,
      changes: [{ fieldName: 'value', fieldValue: false }],
    });
  });

  it('lists and gets by key', async () => {
    const record: SystemConfig = {
      id: 'cfg-1',
      key: 'scalar_docs',
      value: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const findMany = vi.fn().mockResolvedValue([record]);
    const findUnique = vi.fn().mockResolvedValue(record);
    const prisma = {
      systemConfig: {
        findMany,
        findUnique,
      },
    } as unknown as PrismaClient;
    const auditRepository: AuditRepositoryInterface = {
      createAuditRepository: vi.fn(),
    };

    const repo = buildSystemConfigRepository({ prisma, auditRepository });
    const listRes = await repo.listSystemConfigRepository();
    expect(listRes).toEqual({ data: [record] });

    const getRes = await repo.getSystemConfigRepository({ filter: { key: 'scalar_docs' } });
    expect(getRes).toEqual({ data: record });
    expect(findUnique).toHaveBeenCalledWith({ where: { key: 'scalar_docs' } });
  });
});
