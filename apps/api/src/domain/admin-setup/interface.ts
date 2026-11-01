import type { IntegrationConfig } from '@prisma/client';
import type {
  AdminSetupView,
  IntegrationItemView,
  IntegrationKey,
} from './dto.js';

export type StoredUptimeCredentials = {
  username?: string;
  password?: string;
  apiKey?: string;
};

export type StoredGrafanaCredentials = {
  apiToken?: string;
};

export type StoredMailCredentials = {
  port: number;
  secure: boolean;
  username?: string;
  password?: string;
  fromAddress: string;
};

export type StoredCredentials =
  | StoredUptimeCredentials
  | StoredGrafanaCredentials
  | StoredMailCredentials;

export interface AdminSetupRepositoryInterface {
  findByKey(key: IntegrationKey): Promise<IntegrationConfig | null>;
  listAll(): Promise<IntegrationConfig[]>;
  upsert(data: {
    key: IntegrationKey;
    baseUrl: string;
    credentialsEncrypted: string;
    updatedBy: string;
    lastStatus?: string | null;
    lastTestedAt?: Date | null;
    lastError?: string | null;
  }): Promise<IntegrationConfig>;
  updateTestStatus(
    key: IntegrationKey,
    status: {
      lastStatus: 'ok' | 'failed';
      lastTestedAt: Date;
      lastError: string | null;
    },
  ): Promise<IntegrationConfig>;
  deleteByKey(key: IntegrationKey, userId?: string): Promise<boolean>;
}

export interface AdminSetupUseCaseInterface {
  getSetup(): Promise<AdminSetupView>;
  updateIntegration(
    key: string,
    payload: unknown,
    userId: string,
  ): Promise<IntegrationItemView>;
  deleteIntegration(key: string, userId: string): Promise<IntegrationItemView>;
  testIntegration(key: string): Promise<IntegrationItemView>;
  testSendMail(to: string, userId: string): Promise<{ ok: true } | { ok: false; error: string }>;
}
