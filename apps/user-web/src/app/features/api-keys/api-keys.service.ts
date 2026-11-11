import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../core/api-client';

export const API_KEY_SCOPES = ['templates:read','templates:write','uploads:read','uploads:write','mappings:read','mappings:write','campaigns:read','campaigns:write','campaigns:send','recipients:read','smtp:read','embed:create'] as const;
export type ApiKeyScope = typeof API_KEY_SCOPES[number];
export type ApiKeyView = { id: string; projectId: string; name: string; prefix: string; scopes: string[]; expiresAt: string | null; revokedAt: string | null; lastUsedAt: string | null; createdAt: string };
export type CreatedApiKey = ApiKeyView & { secret: string };

@Injectable({ providedIn: 'root' })
export class ApiKeysService {
  private readonly api = inject(ApiClient);
  async list(projectId: string): Promise<ApiKeyView[]> { return firstValueFrom(this.api.get<ApiKeyView[]>(`/projects/${encodeURIComponent(projectId)}/api-keys`)); }
  async create(projectId: string, body: { name: string; scopes: ApiKeyScope[]; expiresAt?: string }): Promise<CreatedApiKey> { return firstValueFrom(this.api.post<CreatedApiKey, typeof body>(`/projects/${encodeURIComponent(projectId)}/api-keys`, body)); }
  async revoke(projectId: string, id: string): Promise<ApiKeyView> { return firstValueFrom(this.api.delete<ApiKeyView>(`/projects/${encodeURIComponent(projectId)}/api-keys/${encodeURIComponent(id)}`)); }
}
