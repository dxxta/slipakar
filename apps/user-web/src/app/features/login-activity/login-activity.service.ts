import { Injectable, inject } from '@angular/core';
import { ApiClient, type PaginatedResponse } from '../../core/api-client';

export type LoginActivitySort = 'createdAt' | 'country' | 'browser' | 'os';
export type LoginActivityItem = {
  id: string;
  userId: string;
  ip: string | null;
  proxy: boolean;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
};
export type LoginActivityQuery = {
  page: number;
  limit: number;
  q?: string;
  sortBy: LoginActivitySort;
  sortDir: 'asc' | 'desc';
};

@Injectable({ providedIn: 'root' })
export class LoginActivityService {
  private readonly api = inject(ApiClient);

  list(query: LoginActivityQuery): import('rxjs').Observable<PaginatedResponse<LoginActivityItem>> {
    const params = new URLSearchParams({
      page: String(query.page),
      limit: String(query.limit),
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    });
    if (query.q) params.set('q', query.q);
    return this.api.getPage<LoginActivityItem>(`/me/login-activity?${params.toString()}`);
  }
}
