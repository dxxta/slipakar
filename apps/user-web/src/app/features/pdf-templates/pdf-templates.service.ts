import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, throwError, type Observable } from 'rxjs';
import { ApiError } from '../../core/api-error';
import { environment } from '../../../environments/environment';
import { ApiClient, type PaginatedResponse } from '../../core/api-client';
import { listQueryString } from '../../core/list-query';
import type { PdfNode } from '../pdf-builder/pdf-node.types';

export interface PdfNodeTree {
  page: {
    size: 'A4';
    margin: number;
  };
  nodes: PdfNode[];
}

export interface PdfTemplateItem {
  id: string;
  projectId: string;
  name: string;
  nodeTree: PdfNodeTree;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePdfTemplatePayload {
  name: string;
  nodeTree: PdfNodeTree;
}

export type UpdatePdfTemplatePayload = Partial<CreatePdfTemplatePayload>;

export interface AttachmentItem {
  id: string;
  projectId: string;
  campaignId?: string | null;
  fileName: string;
  sizeBytes: string;
  kind: string;
  createdAt: string;
}

export interface UploadItem {
  id: string;
  projectId: string;
  fileName: string;
  rowCount: number;
  columns: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface UploadPreview {
  id: string;
  projectId: string;
  fileName: string;
  rowCount: number;
  columns: string[];
  preview: Record<string, string>[];
  createdAt: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class PdfTemplatesService {
  private readonly api = inject(ApiClient);
  private readonly http = inject(HttpClient);

  listTemplates(projectId: string, page = 1, limit = 20, q = '', sortBy = 'createdAt', sortDir: 'asc' | 'desc' = 'desc'): Observable<PaginatedResponse<PdfTemplateItem>> {
    const query = listQueryString({ page, limit, q, sortBy, sortDir });
    return this.api.getPage<PdfTemplateItem>(`/projects/${projectId}/pdf-templates${query}`);
  }

  getTemplate(projectId: string, id: string): Observable<PdfTemplateItem> {
    return this.api.get<PdfTemplateItem>(`/projects/${projectId}/pdf-templates/${id}`);
  }

  createTemplate(projectId: string, payload: CreatePdfTemplatePayload): Observable<PdfTemplateItem> {
    return this.api.post<PdfTemplateItem, CreatePdfTemplatePayload>(
      `/projects/${projectId}/pdf-templates`,
      payload,
    );
  }

  updateTemplate(
    projectId: string,
    id: string,
    payload: UpdatePdfTemplatePayload,
  ): Observable<PdfTemplateItem> {
    return this.api.patch<PdfTemplateItem, UpdatePdfTemplatePayload>(
      `/projects/${projectId}/pdf-templates/${id}`,
      payload,
    );
  }

  deleteTemplate(projectId: string, id: string): Observable<null> {
    return this.api.delete<null>(`/projects/${projectId}/pdf-templates/${id}`);
  }

  previewPdf(projectId: string, nodeTree: PdfNodeTree): Observable<Blob> {
    return this.http
      .post(`${environment.apiBase}/projects/${projectId}/pdf-templates/preview`, { nodeTree }, { withCredentials: true, responseType: 'blob' })
      .pipe(
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse) {
            return throwError(() => new ApiError(error.status, 'PREVIEW_FAILED', error.status === 400 ? 'The template has invalid elements; check the validation messages.' : 'Could not render the preview.'));
          }
          return throwError(() => new ApiError(0, 'NETWORK_ERROR', 'Could not render the preview.'));
        }),
      );
  }

  uploadAttachment(projectId: string, file: File): Observable<AttachmentItem> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('kind', 'extra');
    return this.http
      .post<{ data: AttachmentItem }>(`${environment.apiBase}/projects/${projectId}/attachments`, formData, { withCredentials: true })
      .pipe(
        map((response) => response.data),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse) {
            const body = error.error as { error?: { code?: string; message?: string } } | null;
            return throwError(() => new ApiError(error.status, body?.error?.code ?? 'HTTP_ERROR', body?.error?.message ?? error.message));
          }
          return throwError(() => new ApiError(0, 'NETWORK_ERROR', 'Upload failed'));
        }),
      );
  }

  listAttachments(projectId: string): Observable<AttachmentItem[]> {
    return this.api.get<AttachmentItem[]>(`/projects/${projectId}/attachments`);
  }

  listUploads(projectId: string): Observable<UploadItem[]> {
    return this.api.get<UploadItem[]>(`/projects/${projectId}/uploads`);
  }

  getUploadPreview(projectId: string, uploadId: string): Observable<UploadPreview> {
    return this.api.get<UploadPreview>(`/projects/${projectId}/uploads/${uploadId}`);
  }
}
