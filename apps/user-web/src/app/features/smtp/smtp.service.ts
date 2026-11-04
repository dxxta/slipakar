import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import { ApiClient, type PaginatedResponse } from '../../core/api-client';
import { listQueryString } from '../../core/list-query';

export interface SmtpConnection {
  id: string;
  projectId: string;
  host: string;
  port: number;
  username: string;
  secure: boolean;
  fromAddress?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSmtpPayload {
  host: string;
  port: number;
  username: string;
  password: string;
  secure: boolean;
  fromAddress: string;
}

export interface UpdateSmtpPayload {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  secure?: boolean;
  fromAddress?: string;
}

export interface SmtpTestResult {
  ok: boolean;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class SmtpService {
  private readonly api = inject(ApiClient);

  list(projectId: string, page = 1, limit = 20, q = '', sortBy = 'createdAt', sortDir: 'asc' | 'desc' = 'desc'): Observable<PaginatedResponse<SmtpConnection>> {
    const query = listQueryString({ page, limit, q, sortBy, sortDir });
    return this.api.getPage<SmtpConnection>(`/projects/${projectId}/smtp${query}`);
  }

  create(projectId: string, payload: CreateSmtpPayload): Observable<SmtpConnection> {
    return this.api.post<SmtpConnection, CreateSmtpPayload>(`/projects/${projectId}/smtp`, payload);
  }

  update(projectId: string, id: string, payload: UpdateSmtpPayload): Observable<SmtpConnection> {
    return this.api.patch<SmtpConnection, UpdateSmtpPayload>(`/projects/${projectId}/smtp/${id}`, payload);
  }

  delete(projectId: string, id: string): Observable<null> {
    return this.api.delete<null>(`/projects/${projectId}/smtp/${id}`);
  }

  test(projectId: string, id: string): Observable<SmtpTestResult> {
    return this.api.post<SmtpTestResult, undefined>(`/projects/${projectId}/smtp/${id}/test`, undefined);
  }
}
