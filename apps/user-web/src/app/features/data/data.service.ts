import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, throwError, type Observable } from 'rxjs';
import { ApiClient } from '../../core/api-client';
import { ApiError } from '../../core/api-error';
import { environment } from '../../../environments/environment';

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
}

export interface FieldMapping {
  id: string;
  templateId: string;
  uploadId: string;
  pdfTemplateId?: string;
  mapping: Record<string, string>;
}

export interface SaveMappingPayload {
  templateId: string;
  uploadId: string;
  pdfTemplateId?: string;
  mapping: Record<string, string>;
}

export interface EmailTemplateSummary {
  id: string;
  projectId: string;
  name: string;
  subject: string;
  bodyHtml: string;
}

export interface PdfTemplateSummary {
  id: string;
  projectId: string;
  name: string;
}

type ApiEnvelope<T> = { message: string; data: T; success: true };
type ApiErrorEnvelope = { error?: { code?: string; message?: string } };

@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly api = inject(ApiClient);
  private readonly http = inject(HttpClient);

  listUploads(projectId: string): Observable<UploadItem[]> {
    return this.api.get<UploadItem[]>(`/projects/${projectId}/uploads`);
  }

  getUploadPreview(projectId: string, id: string): Observable<UploadPreview> {
    return this.api.get<UploadPreview>(`/projects/${projectId}/uploads/${id}`);
  }

  uploadFile(projectId: string, file: File): Observable<UploadItem> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http
      .post<ApiEnvelope<UploadItem>>(`${environment.apiBase}/projects/${projectId}/uploads`, formData, {
        withCredentials: true,
      })
      .pipe(
        map((res) => res.data),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse) {
            const body = error.error as ApiErrorEnvelope | null;
            return throwError(
              () => new ApiError(error.status, body?.error?.code ?? 'HTTP_ERROR', body?.error?.message ?? error.message),
            );
          }
          return throwError(() => (error instanceof ApiError ? error : new ApiError(0, 'NETWORK_ERROR', 'Upload failed')));
        }),
      );
  }

  deleteUpload(projectId: string, id: string): Observable<null> {
    return this.api.delete<null>(`/projects/${projectId}/uploads/${id}`);
  }

  listTemplates(projectId: string): Observable<EmailTemplateSummary[]> {
    return this.api.getPage<EmailTemplateSummary>(`/projects/${projectId}/templates?page=1&limit=100&sortBy=createdAt&sortDir=desc`).pipe(map((page) => page.data));
  }

  listPdfTemplates(projectId: string): Observable<PdfTemplateSummary[]> {
    return this.api.getPage<PdfTemplateSummary>(`/projects/${projectId}/pdf-templates?page=1&limit=100&sortBy=createdAt&sortDir=desc`).pipe(map((page) => page.data));
  }

  getMapping(projectId: string, templateId: string, uploadId: string): Observable<FieldMapping> {
    return this.api.get<FieldMapping>(`/projects/${projectId}/mappings?templateId=${encodeURIComponent(templateId)}&uploadId=${encodeURIComponent(uploadId)}`);
  }

  saveMapping(projectId: string, payload: SaveMappingPayload): Observable<FieldMapping> {
    return this.api.put<FieldMapping, SaveMappingPayload>(`/projects/${projectId}/mappings`, payload);
  }
}
