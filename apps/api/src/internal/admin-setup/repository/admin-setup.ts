import type { PrismaClient, IntegrationConfig } from '@prisma/client';
import type { IntegrationKey } from '../../../domain/admin-setup/dto.js';
import type { AdminSetupRepositoryInterface } from '../../../domain/admin-setup/interface.js';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';

export class AdminSetupRepository implements AdminSetupRepositoryInterface {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly auditRepository: AuditRepositoryInterface,
  ) {}

  async findByKey(key: IntegrationKey): Promise<IntegrationConfig | null> {
    return this.prisma.integrationConfig.findUnique({
      where: { key },
    });
  }

  async listAll(): Promise<IntegrationConfig[]> {
    return this.prisma.integrationConfig.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async upsert(data: {
    key: IntegrationKey;
    baseUrl: string;
    credentialsEncrypted: string;
    updatedBy: string;
    lastStatus?: string | null;
    lastTestedAt?: Date | null;
    lastError?: string | null;
  }): Promise<IntegrationConfig> {
    const existing = await this.findByKey(data.key);

    const record = await this.prisma.integrationConfig.upsert({
      where: { key: data.key },
      create: {
        key: data.key,
        baseUrl: data.baseUrl,
        credentialsEncrypted: data.credentialsEncrypted,
        updatedBy: data.updatedBy,
        lastStatus: data.lastStatus ?? null,
        lastTestedAt: data.lastTestedAt ?? null,
        lastError: data.lastError ?? null,
      },
      update: {
        baseUrl: data.baseUrl,
        credentialsEncrypted: data.credentialsEncrypted,
        updatedBy: data.updatedBy,
        ...(data.lastStatus !== undefined ? { lastStatus: data.lastStatus } : {}),
        ...(data.lastTestedAt !== undefined ? { lastTestedAt: data.lastTestedAt } : {}),
        ...(data.lastError !== undefined ? { lastError: data.lastError } : {}),
      },
    });

    await this.auditRepository.createAuditRepository({
      entity: 'IntegrationConfig',
      entityId: record.id,
      action: existing ? 'update' : 'create',
      auditUserId: data.updatedBy,
      changes: [
        { fieldName: 'key', fieldValue: data.key },
        { fieldName: 'baseUrl', fieldValue: data.baseUrl },
        // Never audit-log secrets
      ],
    });

    return record;
  }

  async updateTestStatus(
    key: IntegrationKey,
    status: {
      lastStatus: 'ok' | 'failed';
      lastTestedAt: Date;
      lastError: string | null;
    },
  ): Promise<IntegrationConfig> {
    return this.prisma.integrationConfig.update({
      where: { key },
      data: {
        lastStatus: status.lastStatus,
        lastTestedAt: status.lastTestedAt,
        lastError: status.lastError,
      },
    });
  }

  async deleteByKey(key: IntegrationKey, userId?: string): Promise<boolean> {
    const existing = await this.findByKey(key);
    if (!existing) return false;

    await this.prisma.integrationConfig.delete({
      where: { key },
    });

    await this.auditRepository.createAuditRepository({
      entity: 'IntegrationConfig',
      entityId: existing.id,
      action: 'delete',
      auditUserId: userId ?? existing.updatedBy,
      changes: [
        { fieldName: 'key', fieldValue: key },
        { fieldName: 'baseUrl', fieldValue: existing.baseUrl },
      ],
    });

    return true;
  }
}
