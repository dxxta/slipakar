import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import { ApiClient, type PaginatedResponse } from '../../core/api-client';
import { listQueryString } from '../../core/list-query';

export type CampaignStatus = 'draft' | 'sending' | 'completed' | 'completed_with_errors' | string;
export type RecipientStatus = 'pending' | 'sent' | 'failed';

export interface RecipientCounts {
  pending: number;
  sent: number;
  failed: number;
  total: number;
}

export interface CampaignItem {
  id: string;
  projectId: string;
  emailTemplateId: string;
  pdfTemplateId?: string | null;
  /** Empty when the campaign is sent through the platform mailer. */
  smtpConnectionId?: string | null;
  uploadId: string;
  emailColumn: string;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignDetail extends CampaignItem {
  counts: RecipientCounts;
}

export interface CampaignRecipientItem {
  id: string;
  campaignId: string;
  rowIndex: number;
  email: string;
  status: RecipientStatus;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCampaignPayload {
  emailTemplateId: string;
  pdfTemplateId?: string;
  /** Leave out to send through the platform mailer. */
  smtpConnectionId?: string;
  uploadId: string;
  emailColumn: string;
}

export interface SendCampaignResult {
  campaignId: string;
  status: string;
  enqueuedCount: number;
}

export interface RecipientsListResponse {
  data: CampaignRecipientItem[];
  metadata: {
    page: number;
    limit: number;
    total: number;
  };
}

@Injectable({ providedIn: 'root' })
export class CampaignsService {
  private readonly api = inject(ApiClient);

  listCampaigns(projectId: string, page = 1, limit = 20, q = '', sortBy = 'createdAt', sortDir: 'asc' | 'desc' = 'desc'): Observable<PaginatedResponse<CampaignItem>> {
    const query = listQueryString({ page, limit, q, sortBy, sortDir });
    return this.api.getPage<CampaignItem>(`/projects/${projectId}/campaigns${query}`);
  }

  getCampaign(projectId: string, id: string): Observable<CampaignDetail> {
    return this.api.get<CampaignDetail>(`/projects/${projectId}/campaigns/${id}`);
  }

  createCampaign(projectId: string, payload: CreateCampaignPayload): Observable<CampaignItem> {
    return this.api.post<CampaignItem, CreateCampaignPayload>(`/projects/${projectId}/campaigns`, payload);
  }

  sendCampaign(projectId: string, id: string): Observable<SendCampaignResult> {
    // Sending lets the server decrypt the project data, so the user's consent goes with every request.
    return this.api.post<SendCampaignResult, { consent: true }>(`/projects/${projectId}/campaigns/${id}/send`, { consent: true });
  }

  stopCampaign(projectId: string, id: string): Observable<{ campaignId: string; status: string }> {
    return this.api.post<{ campaignId: string; status: string }, Record<string, never>>(`/projects/${projectId}/campaigns/${id}/stop`, {});
  }

  listRecipients(
    projectId: string,
    id: string,
    page = 1,
    limit = 20,
    status?: RecipientStatus,
    q = '',
    sortBy = 'rowIndex',
    sortDir: 'asc' | 'desc' = 'asc',
  ): Observable<PaginatedResponse<CampaignRecipientItem>> {
    const query = new URLSearchParams({ page: String(page), limit: String(limit), sortBy, sortDir });
    if (q.trim()) query.set('q', q.trim());
    let url = `/projects/${projectId}/campaigns/${id}/recipients?${query.toString()}`;
    if (status) {
      url += `&status=${status}`;
    }
    return this.api.getPage<CampaignRecipientItem>(url);
  }

  retryRecipient(projectId: string, campaignId: string, recipientId: string): Observable<CampaignRecipientItem> {
    return this.api.post<CampaignRecipientItem, { consent: true }>(
      `/projects/${projectId}/campaigns/${campaignId}/recipients/${recipientId}/retry`,
      { consent: true },
    );
  }
}
