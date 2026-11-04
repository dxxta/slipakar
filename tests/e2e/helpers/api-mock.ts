import type { Page, Route } from '@playwright/test';
import type { Request } from '@playwright/test';
import { z } from 'zod';
import { createCampaignsDto, listRecipientsQueryDto } from '../../../apps/api/src/domain/campaigns/dto.js';
import { createMappingDto } from '../../../apps/api/src/domain/mapping/dto.js';
import { createPdfTemplatesDto, updatePdfTemplatesDto } from '../../../apps/api/src/domain/pdf-templates/dto.js';
import { createProjectsDto, listProjectsQueryDto, updateProjectsDto } from '../../../apps/api/src/domain/projects/dto.js';
import { createSmtpDto, listSmtpQueryDto, updateSmtpDto } from '../../../apps/api/src/domain/smtp/dto.js';
import { createTemplateDto, listTemplatesQueryDto, updateTemplateDto } from '../../../apps/api/src/domain/templates/dto.js';
import { listPdfTemplatesQueryDto } from '../../../apps/api/src/domain/pdf-templates/dto.js';
import { listCampaignsQueryDto } from '../../../apps/api/src/domain/campaigns/dto.js';
import { listNotificationsQueryDto } from '../../../apps/api/src/domain/notifications/dto.js';
import { listUserNoticesQueryDto, userNoticeViewDto } from '../../../apps/api/src/domain/user-notices/dto.js';
import { listLoginActivityQueryDto, loginEventViewDto } from '../../../apps/api/src/domain/login-activity/dto.js';
import { listActivityQueryDto, auditLogViewSchema } from '../../../apps/api/src/domain/audit/dto.js';
import { updateThemePreferencesDto } from '../../../apps/api/src/domain/preferences/dto.js';

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: string;
  image?: string | null;
}

export type MockThemePreference = {
  themeMode: 'light' | 'dark' | 'system';
  themeAccent: 'slate' | 'blue' | 'green' | 'violet' | 'rose' | 'amber';
};

export interface MockProject {
  id: string;
  name: string;
  rateLimitPerMinute: number;
  maxUploadBytes: number;
  maxRows: number;
  storageQuotaBytes: string;
}

export interface MockSmtp {
  id: string;
  projectId: string;
  host: string;
  port: number;
  username: string;
  secure: boolean;
  fromAddress?: string | null;
  createdAt: string;
}

export interface MockTemplate {
  id: string;
  projectId: string;
  name: string;
  subject: string;
  bodyHtml: string;
  createdAt: string;
}

export interface MockUpload {
  id: string;
  projectId: string;
  fileName: string;
  rowCount: number;
  columns: string[];
  preview: Record<string, string>[];
  createdAt: string;
}

export interface MockMapping {
  id: string;
  templateId: string;
  uploadId: string;
  pdfTemplateId?: string;
  mapping: Record<string, string>;
}

export interface MockRecipient {
  id: string;
  campaignId: string;
  rowIndex: number;
  email: string;
  status: 'pending' | 'sent' | 'failed';
  errorMessage?: string | null;
}

export interface MockAttachment {
  id: string;
  projectId: string;
  campaignId?: string | null;
  fileName: string;
  sizeBytes: string;
  kind: string;
  createdAt: string;
}

export interface MockPdfNodeBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type MockPdfNode =
  | (MockPdfNodeBase & {
      type: 'text';
      content: string;
      style: {
        fontSize: number;
        bold: boolean;
        align: 'left' | 'center' | 'right';
        color: string;
      };
    })
  | (MockPdfNodeBase & {
      type: 'table';
      rows: string[][];
      columnAligns?: ('left' | 'center' | 'right')[];
      columnWidths?: number[];
      headerFill?: string;
      zebra?: boolean;
      boldRows?: number[];
      style: {
        fontSize: number;
        headerBold: boolean;
        borderColor: string;
      };
    })
  | (MockPdfNodeBase & {
      type: 'image';
      attachmentId: string;
    })
  | (MockPdfNodeBase & {
      type: 'divider';
      style: {
        color: string;
        thickness: number;
      };
    });

export interface MockPdfNodeTree {
  page: {
    size: 'A4';
    margin: number;
  };
  nodes: MockPdfNode[];
}

export interface MockPdfTemplate {
  id: string;
  projectId: string;
  name: string;
  nodeTree: MockPdfNodeTree;
  createdAt: string;
  updatedAt: string;
}

export interface MockCampaign {
  id: string;
  projectId: string;
  emailTemplateId: string;
  pdfTemplateId?: string | null;
  smtpConnectionId: string;
  uploadId: string;
  emailColumn: string;
  status: 'draft' | 'sending' | 'completed' | 'completed_with_errors';
  createdAt: string;
  updatedAt: string;
  getPollCount: number;
  sendCalls: number;
}

export interface MockNotification {
  id: string;
  projectId: string;
  campaignId: string | null;
  type: string;
  message: string;
  createdAt: string;
  readAt: string | null;
}

export type MockUserNotice = { id: string; userId: string; broadcastId?: string | null; title: string; message: string; readAt: string | null; createdAt: string };
export type MockLoginEvent = { id: string; userId: string; ip: string | null; proxy: boolean; browser: string | null; os: string | null; deviceType: string | null; country: string | null; region: string | null; city: string | null; latitude: number | null; longitude: number | null; createdAt: string; userEmail?: string; userName?: string };

export type MockPdfTemplateRequest = { method: 'POST' | 'PATCH'; id?: string; body: unknown };

export class MockApiStore {
  accountDisabled = false;
  user: MockUser | null = {
    id: 'user-1',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'user',
  };
  themePreference: MockThemePreference = { themeMode: 'system', themeAccent: 'slate' };

  projects: MockProject[] = [];
  smtpConnections: MockSmtp[] = [];
  templates: MockTemplate[] = [];
  uploads: MockUpload[] = [];
  mappings: MockMapping[] = [];
  campaigns: MockCampaign[] = [];
  recipients: MockRecipient[] = [];
  pdfTemplates: MockPdfTemplate[] = [];
  pdfTemplateRequests: MockPdfTemplateRequest[] = [];
  notifications: MockNotification[] = [];
  userNotices: MockUserNotice[] = [];
  loginActivity: MockLoginEvent[] = [];
  attachments: MockAttachment[] = [];

  // Feature flags
  pdfBuilderEnabled: boolean = true;

  // Track send calls
  sendRequests: Array<{ projectId: string; campaignId: string }> = [];

  reset(): void {
    this.accountDisabled = false;
    this.user = {
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'user',
    };
    this.themePreference = { themeMode: 'system', themeAccent: 'slate' };
    this.projects = [];
    this.smtpConnections = [];
    this.templates = [];
    this.uploads = [];
    this.mappings = [];
    this.campaigns = [];
    this.recipients = [];
    this.pdfTemplates = [];
    this.pdfTemplateRequests = [];
    this.notifications = [];
    this.userNotices = [];
    this.loginActivity = [];
    this.attachments = [];
    this.pdfBuilderEnabled = true;
    this.sendRequests = [];
  }
}

export async function setupApiMock(page: Page, store?: MockApiStore): Promise<MockApiStore> {
  const s = store ?? new MockApiStore();

  const success = <T>(data: T, message = 'Success') => ({
    message,
    data,
    success: true as const,
  });

  const failure = (status: number, code: string, message: string) => ({
    status,
    body: JSON.stringify({ error: { code, message } }),
    headers: { 'Content-Type': 'application/json' },
  });

  const parseBody = <T>(request: Request, schema: z.ZodType<T>):
    | { success: true; data: T }
    | { success: false; issues: z.ZodIssue[] } => {
    let body: unknown;
    try {
      body = request.postDataJSON();
    } catch {
      body = undefined;
    }
    const parsed = schema.safeParse(body);
    return parsed.success ? parsed : { success: false, issues: parsed.error.issues };
  };

  const paginated = <T>(data: T[], page: number, limit: number, total: number) => ({
    message: 'Success',
    data,
    metadata: { page, limit, total },
    success: true as const,
  });

  const pageAndSort = <T extends object>(items: T[], page: number, limit: number, sortBy: string, sortDir: 'asc' | 'desc', q = '') => {
    const filtered = q ? items.filter((item) => Object.values(item as Record<string, unknown>).some((value) => String(value ?? '').toLowerCase().includes(q.toLowerCase()))) : items;
    const sorted = [...filtered].sort((left, right) => {
      const a = (left as Record<string, unknown>)[sortBy]; const b = (right as Record<string, unknown>)[sortBy];
      const order = String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
      return sortDir === 'asc' ? order : -order;
    });
    const start = (page - 1) * limit;
    return paginated(sorted.slice(start, start + limit), page, limit, sorted.length);
  };

  const json = (route: Route, status: number, data: unknown) =>
    route.fulfill({
      status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

  // Global handler for API routes only: /api/** and /projects/**
  // Note: Must match /api/... or /projects/... when called as an API endpoint, not browser document navigation
  await page.route(
    (url) => {
      const pathname = url.pathname;
      return (
        pathname.startsWith('/api/') ||
        pathname.startsWith('/admin/') ||
        pathname.startsWith('/projects/') ||
        pathname === '/projects' ||
        pathname.startsWith('/notifications/') ||
        pathname === '/me/avatar' ||
        pathname.startsWith('/me/avatar/') ||
        pathname === '/me/preferences'
        || pathname.startsWith('/me/notices')
        || pathname === '/me/login-activity'
      );
    },
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const method = request.method();
      const resourceType = request.resourceType();

      // If this is a page navigation / document request (HTML) for /projects or /projects/..., DO NOT intercept! Let the dev server serve the Angular index.html!
      if (resourceType === 'document') {
        return route.continue();
      }

      if (path === '/me/preferences') {
        if (!s.user) return json(route, 401, { error: { code: 'UNAUTHORIZED', message: 'Sign in required' } });
        if (method === 'GET') return json(route, 200, success(s.themePreference));
        if (method === 'PATCH') {
          const parsed = parseBody(request, updateThemePreferencesDto);
          if (!parsed.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Invalid theme preference' } });
          s.themePreference = { ...s.themePreference, ...parsed.data };
          return json(route, 200, success(s.themePreference, 'Preferences updated successfully'));
        }
        return json(route, 404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
      }

      if (path.startsWith('/me/notices')) {
        if (!s.user) return json(route, 401, { error: { code: 'UNAUTHORIZED', message: 'Sign in required' } });
        if (path === '/me/notices/unread-count' && method === 'GET') {
          return json(route, 200, success({ unreadCount: s.userNotices.filter((notice) => notice.readAt === null).length }, 'Unread notices count retrieved successfully'));
        }
        if (path === '/me/notices' && method === 'GET') {
          const query = listUserNoticesQueryDto.safeParse(Object.fromEntries(url.searchParams.entries()));
          if (!query.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: query.error.issues } });
          const items = s.userNotices.filter((notice) => !query.data.unreadOnly || notice.readAt === null);
          if (items.some((notice) => !userNoticeViewDto.safeParse(notice).success)) return json(route, 500, { error: { code: 'INTERNAL', message: 'Invalid notice fixture' } });
          return json(route, 200, pageAndSort(items, query.data.page, query.data.limit, 'createdAt', 'desc'));
        }
        if (path === '/me/notices/mark-all-read' && method === 'POST') {
          if (request.postDataBuffer()?.length) return json(route, 400, { error: { code: 'VALIDATION', message: 'Request body must be empty' } });
          const unread = s.userNotices.filter((notice) => notice.readAt === null);
          const readAt = new Date().toISOString(); unread.forEach((notice) => { notice.readAt = readAt; });
          return json(route, 200, success({ updatedCount: unread.length }, 'Notices marked read successfully'));
        }
        const readMatch = path.match(/^\/me\/notices\/([^/]+)\/read$/);
        if (readMatch && method === 'PATCH') {
          if (request.postDataBuffer()?.length) return json(route, 400, { error: { code: 'VALIDATION', message: 'Request body must be empty' } });
          const notice = s.userNotices.find((item) => item.id === decodeURIComponent(readMatch[1]));
          if (!notice) return route.fulfill(failure(404, 'NOT_FOUND', 'Notice not found'));
          notice.readAt ??= new Date().toISOString();
          const valid = userNoticeViewDto.safeParse(notice);
          if (!valid.success) return json(route, 500, { error: { code: 'INTERNAL', message: 'Invalid notice fixture' } });
          return json(route, 200, success(valid.data, 'Notice marked read successfully'));
        }
        return route.fulfill(failure(404, 'NOT_FOUND', 'Notice not found'));
      }

      if (path === '/me/login-activity' && method === 'GET') {
        if (!s.user) return json(route, 401, { error: { code: 'UNAUTHORIZED', message: 'Sign in required' } });
        const query = listLoginActivityQueryDto.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!query.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: query.error.issues } });
        const items = s.loginActivity.filter((event) => event.userId === s.user?.id && (!query.data.q || JSON.stringify(event).toLowerCase().includes(query.data.q.toLowerCase())));
        if (items.some((event) => !loginEventViewDto.safeParse(event).success)) return json(route, 500, { error: { code: 'INTERNAL', message: 'Invalid login activity fixture' } });
        return json(route, 200, pageAndSort(items, query.data.page, query.data.limit, query.data.sortBy, query.data.sortDir));
      }

      // 1. Auth routes
      if (path === '/api/auth/get-session') {
        if (s.accountDisabled) return json(route, 403, { error: { code: 'ACCOUNT_DISABLED', message: 'This account is disabled' } });
        if (s.user) {
          return json(route, 200, { user: s.user, session: { id: 'sess-1' } });
        }
        return json(route, 200, null);
      }

      if (path === '/me/avatar') {
        if (!s.user) return json(route, 401, { error: { code: 'UNAUTHORIZED', message: 'Sign in required' } });
        if (method === 'POST') {
          const contentType = request.headers()['content-type'] ?? '';
          const body = request.postDataBuffer();
          const boundary = contentType.match(/boundary=([^;]+)/)?.[1];
          if (!contentType.startsWith('multipart/form-data;') || !boundary || !body) return json(route, 400, { error: { code: 'VALIDATION', message: 'Expected multipart file upload' } });
          const parts = body.toString('latin1').split(`--${boundary}`).filter((part) => part.includes('Content-Disposition: form-data'));
          if (parts.length !== 1) return json(route, 400, { error: { code: 'VALIDATION', message: 'Exactly one file field is required' } });
          const part = parts[0];
          const fileHeader = part.match(/name="file"; filename="[^"]+"\r\nContent-Type: (image\/(?:png|jpeg|webp))\r\n/i);
          const fileContents = part.split('\r\n\r\n')[1]?.replace(/\r\n$/, '') ?? '';
          const fileBytes = Buffer.from(fileContents, 'latin1');
          if (!fileHeader || fileBytes.length === 0) return json(route, 400, { error: { code: 'VALIDATION', message: 'A single file field is required' } });
          if (fileBytes.length > 2 * 1024 * 1024) return json(route, 400, { error: { code: 'FILE_TOO_LARGE', message: 'Avatar file exceeds 2 MB' } });
          const mimeType = fileHeader[1]?.toLowerCase();
          const validMagic = mimeType === 'image/png'
            ? fileBytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
            : mimeType === 'image/jpeg'
              ? fileBytes[0] === 0xff && fileBytes[1] === 0xd8 && fileBytes[2] === 0xff
              : mimeType === 'image/webp'
                ? fileBytes.toString('ascii', 0, 4) === 'RIFF' && fileBytes.toString('ascii', 8, 12) === 'WEBP'
                : false;
          if (!validMagic) return json(route, 400, { error: { code: 'INVALID_FILE_TYPE', message: 'Avatar contents do not match PNG, JPEG, or WebP' } });
          s.user.image = `/me/avatar/${encodeURIComponent(s.user.id)}?v=mock-hash`;
          return json(route, 200, success({ url: s.user.image }, 'Avatar uploaded successfully'));
        }
        if (method === 'DELETE') {
          if (request.postDataBuffer()?.length) return json(route, 400, { error: { code: 'VALIDATION', message: 'Delete request must not have a body' } });
          s.user.image = null;
          return json(route, 200, success(null, 'Avatar removed successfully'));
        }
        return json(route, 404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
      }

      if (path.startsWith('/me/avatar/') && method === 'GET') {
        if (!s.user) return json(route, 401, { error: { code: 'UNAUTHORIZED', message: 'Sign in required' } });
        if (decodeURIComponent(path.slice('/me/avatar/'.length)) !== s.user.id || !s.user.image) return json(route, 404, { error: { code: 'NOT_FOUND', message: 'Avatar not found' } });
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aWQAAAAASUVORK5CYII=', 'base64');
        return route.fulfill({ status: 200, contentType: 'image/png', body: png });
      }

      if (path === '/api/auth/sign-in/social') {
        const parsed = parseBody(request, z.strictObject({ provider: z.literal('google'), callbackURL: z.string() }));
        if (!parsed.success) return json(route, 400, { code: 'VALIDATION_ERROR', message: 'Validation failed' });
        return json(route, 200, { url: 'http://localhost:4300/' });
      }

      if (path === '/api/auth/sign-out') {
        const parsed = parseBody(request, z.strictObject({}));
        if (!parsed.success) return json(route, 400, { code: 'VALIDATION_ERROR', message: 'Validation failed' });
        s.user = null;
        return json(route, 200, { success: true });
      }

      if (path === '/api/auth/update-user' && method === 'POST') {
        const parsed = parseBody(request, z.strictObject({ name: z.string().min(1).optional(), image: z.string().nullable().optional() }));
        if (!parsed.success) return json(route, 400, { code: 'VALIDATION_ERROR', message: 'Validation failed' });
        if (!s.user) return json(route, 401, { code: 'UNAUTHORIZED', message: 'Sign in required' });
        Object.assign(s.user, parsed.data);
        return json(route, 200, { status: true });
      }

      if (path === '/api/auth/change-email' && method === 'POST') {
        const parsed = parseBody(request, z.strictObject({ newEmail: z.string().email(), callbackURL: z.string().optional() }));
        if (!parsed.success) return json(route, 400, { code: 'VALIDATION_ERROR', message: 'Validation failed' });
        if (!s.user) return json(route, 401, { code: 'UNAUTHORIZED', message: 'Sign in required' });
        if (parsed.data.newEmail === s.user.email) return json(route, 400, { status: false, message: 'Email is the same' });
        return json(route, 200, { status: true });
      }

      // 2. /projects (list or create)
      if (path === '/projects') {
        if (method === 'GET') {
          const query = listProjectsQueryDto.safeParse(Object.fromEntries(url.searchParams.entries()));
          if (!query.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: query.error.issues } });
          return json(route, 200, pageAndSort(s.projects, query.data.page, query.data.limit, query.data.sortBy, query.data.sortDir, query.data.q));
        }
        if (method === 'POST') {
          const parsed = parseBody(request, createProjectsDto);
          if (!parsed.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: parsed.issues } });
          const body = parsed.data;
          const newProj: MockProject = {
            id: `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: body.name,
            rateLimitPerMinute: 5,
            maxUploadBytes: 5_242_880,
            maxRows: 10_000,
            storageQuotaBytes: '1073741824',
          };
          s.projects.push(newProj);
          return json(route, 201, success(newProj, 'Project created successfully'));
        }
      }

      // Project routes: /projects/:projectId/...
      const projectRegex = /^\/projects\/([^/]+)(.*)$/;
      const projectMatch = path.match(projectRegex);
      if (projectMatch) {
        const projectId = projectMatch[1];
        const subpath = projectMatch[2]; // e.g. "", "/smtp", "/templates", "/campaigns/c-1/send"

        if (subpath === '/activity' && method === 'GET') {
          const query = listActivityQueryDto.safeParse(Object.fromEntries(url.searchParams.entries()));
          if (!query.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: query.error.issues } });
          const activity: Array<{ id: string; entity: string; entityId: string; action: 'create' | 'update' | 'delete' | 'read'; fieldName: string; fieldValue: unknown | null; userId: string; createdAt: string }> = [];
          if (activity.some((item) => !auditLogViewSchema.safeParse(item).success)) return json(route, 500, { error: { code: 'INTERNAL', message: 'Invalid activity fixture' } });
          return json(route, 200, paginated(activity, query.data.page, query.data.limit, activity.length));
        }

        // /projects/:projectId
        if (!subpath || subpath === '') {
          const project = s.projects.find((p) => p.id === projectId);
          if (!project) return route.fulfill(failure(404, 'NOT_FOUND', 'Project not found'));

          if (method === 'GET') {
            return json(route, 200, success(project));
          }
          if (method === 'PATCH') {
            const parsed = parseBody(request, updateProjectsDto);
            if (!parsed.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: parsed.issues } });
            const body = parsed.data;
            if (body.name) project.name = body.name;
            return json(route, 200, success(project, 'Project updated successfully'));
          }
          if (method === 'DELETE') {
            s.projects = s.projects.filter((p) => p.id !== projectId);
            return json(route, 200, success(null, 'Project deleted successfully'));
          }
        }

        // SMTP routes: /projects/:projectId/smtp[/:smtpId][/test]
        if (subpath.startsWith('/smtp')) {
          const smtpMatch = subpath.match(/^\/smtp(?:\/([^/]+)(?:\/(test))?)?$/);
          const smtpId = smtpMatch?.[1];
          const isTest = smtpMatch?.[2] === 'test';

          if (isTest && smtpId) {
            if (request.postData()) {
              let body: unknown;
              try {
                body = request.postDataJSON();
              } catch {
                return route.fulfill(failure(400, 'VALIDATION', 'This endpoint does not accept a request body'));
              }
              if (typeof body !== 'object' || body === null || Object.keys(body).length > 0) {
                return route.fulfill(failure(400, 'VALIDATION', 'This endpoint does not accept a request body'));
              }
            }
            return json(route, 200, success({ ok: true }, 'SMTP test successful'));
          }

          if (!smtpId) {
            if (method === 'GET') {
              const list = s.smtpConnections.filter((c) => c.projectId === projectId);
              const query = listSmtpQueryDto.safeParse(Object.fromEntries(url.searchParams.entries()));
              if (!query.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: query.error.issues } });
              return json(route, 200, pageAndSort(list, query.data.page, query.data.limit, query.data.sortBy, query.data.sortDir, query.data.q));
            }
            if (method === 'POST') {
              const parsed = parseBody(request, createSmtpDto);
              if (!parsed.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: parsed.issues } });
              const body = parsed.data;
              const newSmtp: MockSmtp = {
                id: `smtp-${Date.now()}`,
                projectId,
                host: body.host,
                port: Number(body.port),
                username: body.username,
                secure: body.secure,
                fromAddress: body.fromAddress,
                createdAt: new Date().toISOString(),
              };
              s.smtpConnections.push(newSmtp);
              return json(route, 201, success(newSmtp, 'SMTP connection created'));
            }
          } else {
            const smtp = s.smtpConnections.find((c) => c.id === smtpId && c.projectId === projectId);
            if (!smtp) return route.fulfill(failure(404, 'NOT_FOUND', 'SMTP not found'));

            if (method === 'GET') {
              return json(route, 200, success(smtp));
            }
            if (method === 'PATCH') {
              const parsed = parseBody(request, updateSmtpDto);
              if (!parsed.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: parsed.issues } });
              const body = parsed.data;
              Object.assign(smtp, body);
              return json(route, 200, success(smtp, 'SMTP updated'));
            }
            if (method === 'DELETE') {
              s.smtpConnections = s.smtpConnections.filter((c) => c.id !== smtpId);
              return json(route, 200, success(null, 'SMTP deleted'));
            }
          }
        }

        // Templates routes: /projects/:projectId/templates[/:templateId]
        if (subpath.startsWith('/templates')) {
          const tplMatch = subpath.match(/^\/templates(?:\/([^/]+))?$/);
          const tplId = tplMatch?.[1];

          if (!tplId) {
            if (method === 'GET') {
              const list = s.templates.filter((t) => t.projectId === projectId);
              const query = listTemplatesQueryDto.safeParse(Object.fromEntries(url.searchParams.entries()));
              if (!query.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: query.error.issues } });
              return json(route, 200, pageAndSort(list, query.data.page, query.data.limit, query.data.sortBy, query.data.sortDir, query.data.q));
            }
            if (method === 'POST') {
              const parsed = parseBody(request, createTemplateDto);
              if (!parsed.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: parsed.issues } });
              const body = parsed.data;
              // Check unsafe placeholder syntax in API
              if (body.bodyHtml.includes('{{#if') || body.bodyHtml.includes('{{{')) {
                return route.fulfill(failure(400, 'UNSAFE_TEMPLATE', 'Template contains unsafe placeholder syntax'));
              }
              const newTpl: MockTemplate = {
                id: `tpl-${Date.now()}`,
                projectId,
                name: body.name,
                subject: body.subject,
                bodyHtml: body.bodyHtml,
                createdAt: new Date().toISOString(),
              };
              s.templates.push(newTpl);
              return json(route, 201, success(newTpl, 'Template created successfully'));
            }
          } else {
            const tpl = s.templates.find((t) => t.id === tplId && t.projectId === projectId);
            if (!tpl) return route.fulfill(failure(404, 'NOT_FOUND', 'Template not found'));

            if (method === 'GET') {
              return json(route, 200, success(tpl));
            }
            if (method === 'PATCH') {
              const parsed = parseBody(request, updateTemplateDto);
              if (!parsed.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: parsed.issues } });
              const body = parsed.data;
              if (body.bodyHtml && (body.bodyHtml.includes('{{#if') || body.bodyHtml.includes('{{{'))) {
                return route.fulfill(failure(400, 'UNSAFE_TEMPLATE', 'Template contains unsafe placeholder syntax'));
              }
              Object.assign(tpl, body);
              return json(route, 200, success(tpl, 'Template updated successfully'));
            }
            if (method === 'DELETE') {
              s.templates = s.templates.filter((t) => t.id !== tplId);
              return json(route, 200, success(null, 'Template deleted successfully'));
            }
          }
        }

        // PDF Templates routes: /projects/:projectId/pdf-templates[/:id]
        if (subpath.startsWith('/pdf-templates')) {
          if (!s.pdfBuilderEnabled) {
            return route.fulfill(failure(404, 'NOT_FOUND', 'PDF builder feature is disabled'));
          }

          const pdfMatch = subpath.match(/^\/pdf-templates(?:\/([^/]+))?$/);
          const pdfId = pdfMatch?.[1];

          if (!pdfId) {
            if (method === 'GET') {
              const list = s.pdfTemplates.filter((t) => t.projectId === projectId);
              const query = listPdfTemplatesQueryDto.safeParse(Object.fromEntries(url.searchParams.entries()));
              if (!query.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: query.error.issues } });
              return json(route, 200, pageAndSort(list, query.data.page, query.data.limit, query.data.sortBy, query.data.sortDir, query.data.q));
            }
            if (method === 'POST') {
              const parsed = parseBody(request, createPdfTemplatesDto);
              if (!parsed.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: parsed.issues } });
              const body = parsed.data;
              s.pdfTemplateRequests.push({ method: 'POST', body });
              const newTpl: MockPdfTemplate = {
                id: `pdf-tpl-${Date.now()}`,
                projectId,
                name: body.name,
                nodeTree: body.nodeTree,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              s.pdfTemplates.push(newTpl);
              return json(route, 201, success(newTpl, 'PDF template created successfully'));
            }
          } else {
            const found = s.pdfTemplates.find((t) => t.id === pdfId && t.projectId === projectId);
            if (!found) {
              return route.fulfill(failure(404, 'NOT_FOUND', 'PDF template not found'));
            }

            if (method === 'GET') {
              return json(route, 200, success(found));
            }
            if (method === 'PATCH') {
              const parsed = parseBody(request, updatePdfTemplatesDto);
              if (!parsed.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: parsed.issues } });
              const body = parsed.data;
              s.pdfTemplateRequests.push({ method: 'PATCH', id: pdfId, body });
              if (body.name !== undefined) found.name = body.name;
              if (body.nodeTree !== undefined) found.nodeTree = body.nodeTree;
              found.updatedAt = new Date().toISOString();
              return json(route, 200, success(found, 'PDF template updated successfully'));
            }
            if (method === 'DELETE') {
              s.pdfTemplates = s.pdfTemplates.filter((t) => t.id !== pdfId);
              return json(route, 200, success(null, 'PDF template deleted successfully'));
            }
          }
        }

        // Attachments routes: /projects/:projectId/attachments[/:id]
        if (subpath.startsWith('/attachments')) {
          const attMatch = subpath.match(/^\/attachments(?:\/([^/]+))?$/);
          const attId = attMatch?.[1];

          if (!attId) {
            if (method === 'GET') {
              const list = s.attachments.filter((a) => a.projectId === projectId);
              return json(route, 200, success(list));
            }
          } else {
            const att = s.attachments.find((a) => a.id === attId && a.projectId === projectId);
            if (!att) return route.fulfill(failure(404, 'NOT_FOUND', 'Attachment not found'));
            if (method === 'GET') {
              return json(route, 200, success(att));
            }
          }
        }

        // Uploads routes: /projects/:projectId/uploads[/:uploadId]
        if (subpath.startsWith('/uploads')) {
          const upMatch = subpath.match(/^\/uploads(?:\/([^/]+))?$/);
          const upId = upMatch?.[1];

          if (!upId) {
            if (method === 'GET') {
              const list = s.uploads.filter((u) => u.projectId === projectId);
              return json(route, 200, success(list));
            }
            if (method === 'POST') {
              const contentType = request.headers()['content-type'] ?? '';
              const multipartBody = request.postDataBuffer()?.toString('latin1') ?? request.postData() ?? '';
              const fieldNames = [...multipartBody.matchAll(/Content-Disposition:[^\r\n]*?name="([^"]+)"/gi)].map(
                (match) => match[1],
              );
              if (
                !contentType.startsWith('multipart/form-data;') ||
                !fieldNames.includes('file') ||
                fieldNames.some((fieldName) => fieldName !== 'file')
              ) {
                return route.fulfill(failure(400, 'VALIDATION', 'A single file field is required'));
              }
              const newUpload: MockUpload = {
                id: `up-${Date.now()}`,
                projectId,
                fileName: 'recipients.csv',
                rowCount: 3,
                columns: ['name', 'email', 'amount'],
                preview: [
                  { name: 'Alice Smith', email: 'alice@example.com', amount: '$1,000' },
                  { name: 'Bob Jones', email: 'bob@example.com', amount: '$2,000' },
                  { name: 'Carol White', email: 'carol@example.com', amount: '$3,000' },
                ],
                createdAt: new Date().toISOString(),
              };
              s.uploads.unshift(newUpload);
              return json(route, 201, success(newUpload, 'File uploaded and parsed successfully'));
            }
          } else {
            const up = s.uploads.find((u) => u.id === upId && u.projectId === projectId);
            if (!up) return route.fulfill(failure(404, 'NOT_FOUND', 'Upload not found'));

            if (method === 'GET') {
              return json(route, 200, success(up));
            }
            if (method === 'DELETE') {
              s.uploads = s.uploads.filter((u) => u.id !== upId);
              return json(route, 200, success(null, 'Upload deleted'));
            }
          }
        }

        // Mappings routes: /projects/:projectId/mappings
        if (subpath.startsWith('/mappings')) {
          if (method === 'GET') {
            const templateId = url.searchParams.get('templateId');
            const uploadId = url.searchParams.get('uploadId');
            const found = s.mappings.find((m) => m.templateId === templateId && m.uploadId === uploadId);
            if (!found) return route.fulfill(failure(404, 'NOT_FOUND', 'Mapping not found'));
            return json(route, 200, success(found));
          }
          if (method === 'PUT') {
            const parsed = parseBody(request, createMappingDto);
            if (!parsed.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: parsed.issues } });
            const body = parsed.data;
            const existing = s.mappings.find((m) => m.templateId === body.templateId && m.uploadId === body.uploadId);
            if (existing) {
              existing.mapping = body.mapping;
              existing.pdfTemplateId = body.pdfTemplateId;
              return json(route, 200, success(existing, 'Mapping updated successfully'));
            }
            const newMap: MockMapping = {
              id: `map-${Date.now()}`,
              templateId: body.templateId,
              uploadId: body.uploadId,
              pdfTemplateId: body.pdfTemplateId,
              mapping: body.mapping,
            };
            s.mappings.push(newMap);
            return json(route, 200, success(newMap, 'Mapping saved successfully'));
          }
        }

        // Campaigns routes: /projects/:projectId/campaigns[/:campaignId][/(send|recipients)]
        if (subpath.startsWith('/campaigns')) {
          const campMatch = subpath.match(/^\/campaigns(?:\/([^/]+)(?:\/(send|recipients(?:\/([^/]+)\/retry)?))?)?$/);
          const campId = campMatch?.[1];
          const action = campMatch?.[2];
          const retryRecipientId = campMatch?.[3];

          if (!campId) {
            if (method === 'GET') {
              const list = s.campaigns.filter((c) => c.projectId === projectId);
              const query = listCampaignsQueryDto.safeParse(Object.fromEntries(url.searchParams.entries()));
              if (!query.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: query.error.issues } });
              return json(route, 200, pageAndSort(list, query.data.page, query.data.limit, query.data.sortBy, query.data.sortDir, query.data.q));
            }
            if (method === 'POST') {
              const parsed = parseBody(request, createCampaignsDto);
              if (!parsed.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: parsed.issues } });
              const body = parsed.data;
              const newCamp: MockCampaign = {
                id: `camp-${Date.now()}`,
                projectId,
                emailTemplateId: body.emailTemplateId,
                pdfTemplateId: body.pdfTemplateId,
                smtpConnectionId: body.smtpConnectionId,
                uploadId: body.uploadId,
                emailColumn: body.emailColumn,
                status: 'draft',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                getPollCount: 0,
                sendCalls: 0,
              };
              s.campaigns.push(newCamp);

              // Populate mock recipients from upload
              const up = s.uploads.find((u) => u.id === body.uploadId);
              const rows = up?.preview ?? [
                { email: 'alice@example.com' },
                { email: 'bob@example.com' },
                { email: 'carol@example.com' },
              ];
              rows.forEach((r, idx) => {
                s.recipients.push({
                  id: `recip-${newCamp.id}-${idx}`,
                  campaignId: newCamp.id,
                  rowIndex: idx,
                  email: r[body.emailColumn] ?? r.email ?? `user${idx}@example.com`,
                  status: 'pending',
                });
              });

              return json(route, 201, success(newCamp, 'Campaign created successfully'));
            }
          } else if (action === 'send') {
            const parsedBody = parseBody(request, z.strictObject({}));
            if (method === 'POST' && !parsedBody.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: parsedBody.issues } });
            const camp = s.campaigns.find((c) => c.id === campId && c.projectId === projectId);
            if (!camp) return route.fulfill(failure(404, 'NOT_FOUND', 'Campaign not found'));

            camp.sendCalls++;
            s.sendRequests.push({ projectId, campaignId: campId });
            camp.status = 'sending';

            return json(
              route,
              200,
              success({ campaignId: campId, status: 'sending', enqueuedCount: 3 }, 'Campaign send triggered'),
            );
          } else if (action?.startsWith('recipients') && method === 'POST' && retryRecipientId) {
            const parsedBody = parseBody(request, z.strictObject({}));
            if (!parsedBody.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: parsedBody.issues } });
            const recipient = s.recipients.find((entry) => entry.id === retryRecipientId && entry.campaignId === campId);
            if (!recipient) return route.fulfill(failure(404, 'NOT_FOUND', 'Recipient not found'));
            recipient.status = 'pending';
            return json(route, 200, success(recipient, 'Recipient reset to pending and enqueued'));
          } else if (action?.startsWith('recipients')) {
            const query = listRecipientsQueryDto.safeParse(Object.fromEntries(url.searchParams.entries()));
            if (!query.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: query.error.issues } });
        const matches = s.recipients.filter((recipient) => recipient.campaignId === campId && (!query.data.status || recipient.status === query.data.status));
        return json(route, 200, pageAndSort(matches, query.data.page, query.data.limit, query.data.sortBy, query.data.sortDir, query.data.q));
          } else {
            // GET /projects/:projectId/campaigns/:campaignId
            const camp = s.campaigns.find((c) => c.id === campId && c.projectId === projectId);
            if (!camp) return route.fulfill(failure(404, 'NOT_FOUND', 'Campaign not found'));

            camp.getPollCount++;

            // Transition status draft -> sending -> completed across successive GETs
            if (camp.status === 'sending' && camp.getPollCount >= 2) {
              camp.status = 'completed';
              // Mark recipients as sent
              s.recipients
                .filter((r) => r.campaignId === campId)
                .forEach((r) => {
                  r.status = 'sent';
                });
            }

            const campRecipients = s.recipients.filter((r) => r.campaignId === campId);
            const counts = {
              total: campRecipients.length,
              pending: campRecipients.filter((r) => r.status === 'pending').length,
              sent: campRecipients.filter((r) => r.status === 'sent').length,
              failed: campRecipients.filter((r) => r.status === 'failed').length,
            };

            return json(route, 200, success({ ...camp, counts }));
          }
        }
      }

      if (path === '/notifications/unread-count' && method === 'GET') {
        if (!s.user) return json(route, 401, { error: { code: 'UNAUTHORIZED', message: 'Sign in required' } });
        const ownedProjectIds = new Set(s.projects.map((project) => project.id));
        const count = s.notifications.filter((notification) =>
          ownedProjectIds.has(notification.projectId) && notification.readAt === null,
        ).length;
        return json(route, 200, success({ count }, 'Unread notifications count retrieved successfully'));
      }

      const notificationReadMatch = path.match(/^\/projects\/([^/]+)\/notifications\/([^/]+)\/read$/);
      if (notificationReadMatch && method === 'POST') {
        const [, projectId, notificationId] = notificationReadMatch;
        if (request.postData()) return json(route, 400, { error: { code: 'VALIDATION', message: 'This endpoint does not accept a request body' } });
        if (!s.projects.some((project) => project.id === projectId)) return route.fulfill(failure(404, 'NOT_FOUND', 'Project not found'));
        const notification = s.notifications.find((item) => item.id === notificationId && item.projectId === projectId);
        if (!notification) return route.fulfill(failure(404, 'NOT_FOUND', 'Notification not found'));
        notification.readAt ??= new Date().toISOString();
        return json(route, 200, success(notification, 'Notification marked read successfully'));
      }

      const notificationReadAllMatch = path.match(/^\/projects\/([^/]+)\/notifications\/read-all$/);
      if (notificationReadAllMatch && method === 'POST') {
        const [, projectId] = notificationReadAllMatch;
        if (request.postData()) return json(route, 400, { error: { code: 'VALIDATION', message: 'This endpoint does not accept a request body' } });
        if (!s.projects.some((project) => project.id === projectId)) return route.fulfill(failure(404, 'NOT_FOUND', 'Project not found'));
        const unreadNotifications = s.notifications.filter((item) => item.projectId === projectId && item.readAt === null);
        const readAt = new Date().toISOString();
        unreadNotifications.forEach((notification) => { notification.readAt = readAt; });
        return json(route, 200, success({ count: unreadNotifications.length }, 'Notifications marked read successfully'));
      }

      const notificationMatch = path.match(/^\/projects\/([^/]+)\/notifications$/);
      if (notificationMatch && method === 'GET') {
        const query = listNotificationsQueryDto.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!query.success) return json(route, 400, { error: { code: 'VALIDATION', message: 'Validation failed', details: query.error.issues } });
        const matches = s.notifications.filter((notification) =>
          notification.projectId === notificationMatch[1] &&
          (query.data.unread === undefined || (query.data.unread === 'true' ? notification.readAt === null : notification.readAt !== null)) &&
          (!query.data.q || `${notification.type} ${notification.message}`.toLowerCase().includes(query.data.q.toLowerCase())),
        );
        return json(route, 200, pageAndSort(matches, query.data.page, query.data.limit, query.data.sortBy, query.data.sortDir));
      }

      return route.continue();
    },
  );

  return s;
}
