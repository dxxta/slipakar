import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import { ApiClient, type PageMetadata, type PaginatedResponse } from '../../core/api-client';

export type BroadcastAudience = 'all' | 'role' | 'users';
export type BroadcastStatus = 'draft' | 'sent';
export type BroadcastSort = 'createdAt' | 'subject' | 'status' | 'sentAt';
export type BroadcastCounts = { total: number; sent: number; failed: number; emailSkipped?: boolean };
export type BroadcastItem = {
  id: string;
  subject: string;
  bodyText: string;
  audience: BroadcastAudience;
  audienceFilter: Record<string, unknown> | null;
  status: BroadcastStatus;
  sentAt: string | null;
  createdBy: string;
  counts: BroadcastCounts;
  createdAt: string;
  updatedAt: string;
};
export type BroadcastPreview = { recipientCount: number; sampleEmails: string[]; renderedSubject: string; renderedBodyText: string };
export type BroadcastPayload = { subject: string; bodyText: string; audience: BroadcastAudience; audienceFilter?: { role: string } | { userIds: string[] } };
export type BroadcastPatch = Partial<BroadcastPayload>;

@Injectable({ providedIn: 'root' })
export class BroadcastsService {
  private readonly api = inject(ApiClient);

  list(options: { page: number; limit: number; q: string; sortBy: BroadcastSort; sortDir: 'asc' | 'desc' }): Observable<PaginatedResponse<BroadcastItem>> {
    const params = new URLSearchParams({ page: String(options.page), limit: String(options.limit), sortBy: options.sortBy, sortDir: options.sortDir });
    if (options.q.trim()) params.set('q', options.q.trim());
    return this.api.getPage<BroadcastItem>(`/admin/broadcasts?${params.toString()}`);
  }

  get(id: string): Observable<BroadcastItem> { return this.api.get<BroadcastItem>(`/admin/broadcasts/${encodeURIComponent(id)}`); }
  create(payload: BroadcastPayload): Observable<BroadcastItem> { return this.api.post<BroadcastItem, BroadcastPayload>('/admin/broadcasts', payload); }
  update(id: string, payload: BroadcastPatch): Observable<BroadcastItem> { return this.api.patch<BroadcastItem, BroadcastPatch>(`/admin/broadcasts/${encodeURIComponent(id)}`, payload); }
  delete(id: string): Observable<null> { return this.api.delete<null>(`/admin/broadcasts/${encodeURIComponent(id)}`); }
  preview(id: string): Observable<BroadcastPreview> { return this.api.post<BroadcastPreview>(`/admin/broadcasts/${encodeURIComponent(id)}/preview`, undefined); }
  send(id: string): Observable<BroadcastItem> { return this.api.post<BroadcastItem>(`/admin/broadcasts/${encodeURIComponent(id)}/send`, undefined); }
}
