import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { type Observable } from 'rxjs';

export type AdminUserSort = 'name' | 'email' | 'createdAt' | 'role' | 'status';
export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  disabledAt: string | null;
  projectCount: number;
};
type Envelope<T> = { message: string; data: T; success: true };
type PageEnvelope<T> = Envelope<T[]> & { metadata: { page: number; limit: number; total: number } };

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);

  list(options: { page: number; limit: number; query: string; sortBy: AdminUserSort; sortDir: 'asc' | 'desc' }): Observable<PageEnvelope<AdminUser>> {
    const params = new URLSearchParams({ page: String(options.page), limit: String(options.limit), sortBy: options.sortBy, sortDir: options.sortDir });
    if (options.query) params.set('q', options.query);
    return this.http.get<PageEnvelope<AdminUser>>(`${environment.apiBase}/admin/users?${params.toString()}`, { withCredentials: true });
  }

  get(id: string): Observable<Envelope<AdminUser>> {
    return this.http.get<Envelope<AdminUser>>(`${environment.apiBase}/admin/users/${encodeURIComponent(id)}`, { withCredentials: true });
  }

  update(id: string, payload: { name?: string; image?: string | null }): Observable<Envelope<AdminUser>> {
    return this.http.patch<Envelope<AdminUser>>(`${environment.apiBase}/admin/users/${encodeURIComponent(id)}`, payload, { withCredentials: true });
  }

  setDisabled(id: string, disabled: boolean): Observable<Envelope<AdminUser>> {
    const action = disabled ? 'disable' : 'enable';
    return this.http.post<Envelope<AdminUser>>(`${environment.apiBase}/admin/users/${encodeURIComponent(id)}/${action}`, {}, { withCredentials: true });
  }
}
