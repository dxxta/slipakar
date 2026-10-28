import type { Prisma, SystemConfig } from '@prisma/client';
import type { RepositoryResponse, ResponseTypeWithoutMetadata } from '../../lib/types.js';
import type { SystemConfigKey } from './dto.js';

export type SystemConfigItem = { key: SystemConfigKey; value: boolean };

export type RedisPubSubClient = {
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string): Promise<unknown>;
  unsubscribe(channel: string): Promise<unknown>;
  on(event: 'message', listener: (channel: string, message: string) => void): unknown;
};

export interface SystemConfigRepositoryInterface {
  listSystemConfigRepository(): Promise<RepositoryResponse<SystemConfig[]>>;
  getSystemConfigRepository(args: { filter: { key: string } }): Promise<RepositoryResponse<SystemConfig | null>>;
  upsertSystemConfigRepository(args: {
    payload: { key: string; value: boolean };
    auditUserId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<RepositoryResponse<SystemConfig>>;
}

export interface FeatureFlagsInterface {
  isEnabled(key: SystemConfigKey): Promise<boolean>;
  notifyChanged(key: SystemConfigKey): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface SystemConfigUseCaseInterface {
  getSystemConfigUseCase(args: { auditUserId: string }): Promise<ResponseTypeWithoutMetadata<SystemConfigItem[]>>;
  updateSystemConfigUseCase(args: {
    key: string;
    payload: unknown;
    auditUserId: string;
  }): Promise<ResponseTypeWithoutMetadata<SystemConfigItem>>;
}
