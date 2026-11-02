import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, throwError, type Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiError } from './api-error';

export type PageMetadata = { page: number; limit: number; total: number };
export type PaginatedResponse<T> = { data: T[]; metadata: PageMetadata };

type ApiEnvelope<T> = { message: string; data: T; success: true };
type ApiPageEnvelope<T> = { message: string; data: T[]; metadata: PageMetadata; success: true };
type ApiErrorEnvelope = { error?: { code?: string; message?: string } };

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  get<T>(path: string): Observable<T> {
    return this.unwrap(this.http.get<ApiEnvelope<T>>(`${environment.apiBase}${path}`, { withCredentials: true }));
  }

  getPage<T>(path: string): Observable<PaginatedResponse<T>> {
    return this.http
      .get<ApiPageEnvelope<T>>(`${environment.apiBase}${path}`, { withCredentials: true })
      .pipe(
        map((envelope) => ({ data: envelope.data, metadata: envelope.metadata })),
        catchError((error: unknown) => throwError(() => this.toApiError(error))),
      );
  }

  post<T, B = unknown>(path: string, body: B): Observable<T> {
    return this.unwrap(this.http.post<ApiEnvelope<T>>(`${environment.apiBase}${path}`, body, { withCredentials: true }));
  }

  put<T, B = unknown>(path: string, body: B): Observable<T> {
    return this.unwrap(this.http.put<ApiEnvelope<T>>(`${environment.apiBase}${path}`, body, { withCredentials: true }));
  }

  patch<T, B = unknown>(path: string, body: B): Observable<T> {
    return this.unwrap(this.http.patch<ApiEnvelope<T>>(`${environment.apiBase}${path}`, body, { withCredentials: true }));
  }

  delete<T>(path: string): Observable<T> {
    return this.unwrap(this.http.delete<ApiEnvelope<T>>(`${environment.apiBase}${path}`, { withCredentials: true }));
  }

  private unwrap<T>(request: Observable<ApiEnvelope<T>>): Observable<T> {
    return request.pipe(
      map((envelope) => envelope.data),
      catchError((error: unknown) => throwError(() => this.toApiError(error))),
    );
  }

  private toApiError(error: unknown): ApiError {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as ApiErrorEnvelope | null;
      return new ApiError(error.status, body?.error?.code ?? 'HTTP_ERROR', body?.error?.message ?? error.message);
    }
    return error instanceof ApiError ? error : new ApiError(0, 'NETWORK_ERROR', 'Request failed');
  }
}
