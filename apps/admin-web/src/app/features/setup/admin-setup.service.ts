import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../core/api-client';

export type IntegrationKey = 'uptime' | 'grafana' | 'mail';
export type IntegrationItem = {
  key: IntegrationKey;
  label: string;
  configured: boolean;
  source: 'database' | 'env' | null;
  baseUrl: string | null;
  hasCredentials: boolean;
  credentialHint: string | null;
  settings: { host: string; port: number; secure: boolean; username: string | null; fromAddress: string } | null;
  lastStatus: 'ok' | 'failed' | null;
  lastTestedAt: string | null;
  lastError: string | null;
};
export type AdminSetupView = { complete: boolean; integrations: IntegrationItem[] };
export type IntegrationUpdate = Record<string, string | number | boolean | undefined>;

@Injectable({ providedIn: 'root' })
export class AdminSetupService {
  private readonly api = inject(ApiClient);
  readonly view = signal<AdminSetupView | null>(null);

  async load(): Promise<AdminSetupView> {
    const result = await firstValueFrom(this.api.get<AdminSetupView>('/admin/setup'));
    this.view.set(result);
    return result;
  }

  async save(key: IntegrationKey, payload: IntegrationUpdate): Promise<IntegrationItem> {
    const cleanPayload = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== ''));
    const result = await firstValueFrom(this.api.put<IntegrationItem, IntegrationUpdate>(`/admin/setup/${key}`, cleanPayload));
    this.updateItem(result);
    return result;
  }

  async test(key: IntegrationKey): Promise<IntegrationItem> {
    const result = await firstValueFrom(this.api.post<IntegrationItem, undefined>(`/admin/setup/${key}/test`, undefined));
    this.updateItem(result);
    return result;
  }

  async clear(key: IntegrationKey): Promise<IntegrationItem> {
    const result = await firstValueFrom(this.api.delete<IntegrationItem>(`/admin/setup/${key}`));
    this.updateItem(result);
    return result;
  }

  private updateItem(item: IntegrationItem): void {
    const current = this.view();
    if (!current) return;
    const integrations = current.integrations.map((entry) => entry.key === item.key ? item : entry);
    this.view.set({ ...current, integrations, complete: integrations.every((entry) => entry.configured && entry.lastStatus === 'ok') });
  }
}
