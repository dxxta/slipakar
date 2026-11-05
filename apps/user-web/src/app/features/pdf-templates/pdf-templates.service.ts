import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
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
