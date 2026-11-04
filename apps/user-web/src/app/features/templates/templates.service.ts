import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import { ApiClient, type PaginatedResponse } from '../../core/api-client';
import { listQueryString } from '../../core/list-query';

export interface EmailTemplate {
  id: string;
  projectId: string;
  name: string;
  subject: string;
  bodyHtml: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTemplatePayload {
  name: string;
  subject: string;
  bodyHtml: string;
}

export interface UpdateTemplatePayload {
  name?: string;
  subject?: string;
  bodyHtml?: string;
}

@Injectable({ providedIn: 'root' })
export class TemplatesService {
  private readonly api = inject(ApiClient);

  list(projectId: string, page = 1, limit = 20, q = '', sortBy = 'createdAt', sortDir: 'asc' | 'desc' = 'desc'): Observable<PaginatedResponse<EmailTemplate>> {
    const query = listQueryString({ page, limit, q, sortBy, sortDir });
    return this.api.getPage<EmailTemplate>(`/projects/${projectId}/templates${query}`);
  }

  get(projectId: string, id: string): Observable<EmailTemplate> {
    return this.api.get<EmailTemplate>(`/projects/${projectId}/templates/${id}`);
  }

  create(projectId: string, payload: CreateTemplatePayload): Observable<EmailTemplate> {
    return this.api.post<EmailTemplate, CreateTemplatePayload>(`/projects/${projectId}/templates`, payload);
  }

  update(projectId: string, id: string, payload: UpdateTemplatePayload): Observable<EmailTemplate> {
    return this.api.patch<EmailTemplate, UpdateTemplatePayload>(`/projects/${projectId}/templates/${id}`, payload);
  }

  delete(projectId: string, id: string): Observable<null> {
    return this.api.delete<null>(`/projects/${projectId}/templates/${id}`);
  }
}
