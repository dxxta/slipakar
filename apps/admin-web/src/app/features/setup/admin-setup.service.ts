import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../core/api-client';

export type IntegrationKey = 'grafana' | 'mail';
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
export type EmbedAccessSettings = { environmentEnabled: boolean; allowedOrigins: string[]; runtimeEnabled: boolean; apiAccessActive: boolean };
export type ApiAccessSettings = { environmentEnabled: boolean; allowedOrigins: string[]; runtimeEnabled: boolean; embed: EmbedAccessSettings };
export type IntegrationUpdate = Record<string, string | number | boolean | undefined>;

@Injectable({ providedIn: 'root' })
export class AdminSetupService {
  private readonly api = inject(ApiClient);
  readonly view = signal<AdminSetupView | null>(null);
  readonly apiAccess = signal<ApiAccessSettings | null>(null);

  async load(): Promise<AdminSetupView> {
    const result = await firstValueFrom(this.api.get<AdminSetupView>('/admin/setup'));
    // The API may still list integrations this app no longer manages; show only the ones it supports.
    result.integrations = result.integrations.filter((item) => (['grafana', 'mail'] as string[]).includes(item.key));
    this.view.set(result);
    try { this.apiAccess.set(await firstValueFrom(this.api.get<ApiAccessSettings>('/admin/api-access'))); } catch { this.apiAccess.set(null); }
    return result;
  }

  async setEmbedAccess(enabled: boolean): Promise<ApiAccessSettings> {
    await firstValueFrom(this.api.put<{ key: string; value: boolean }, { value: boolean }>('/admin/config/embed_enabled', { value: enabled }));
    const result = await firstValueFrom(this.api.get<ApiAccessSettings>('/admin/api-access'));
    this.apiAccess.set(result); return result;
  }

  async setApiAccess(enabled: boolean): Promise<ApiAccessSettings> {
    await firstValueFrom(this.api.put<{ key: string; value: boolean }, { value: boolean }>('/admin/config/api_access_enabled', { value: enabled }));
    const result = await firstValueFrom(this.api.get<ApiAccessSettings>('/admin/api-access'));
    this.apiAccess.set(result); return result;
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
