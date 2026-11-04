import type { Page, Route } from '@playwright/test';
import { z } from 'zod';
import { createBroadcastDto, updateBroadcastDto, listBroadcastsQueryDto, broadcastViewDto, type BroadcastView } from '../../../apps/api/src/domain/broadcasts/dto.js';
import { listAdminLoginActivityQueryDto, loginEventViewDto, type LoginEventView } from '../../../apps/api/src/domain/login-activity/dto.js';
import { adminSetupViewDto, updateGrafanaIntegrationDto, updateMailIntegrationDto, updateUptimeIntegrationDto, type IntegrationItemView, type IntegrationKey } from '../../../apps/api/src/domain/admin-setup/dto.js';
import { updateThemePreferencesDto } from '../../../apps/api/src/domain/preferences/dto.js';
import { updateSystemConfigDto } from '../../../apps/api/src/domain/system-config/dto.js';
import { adminUserViewSchema, disableUserDto, listAdminUsersQueryDto, updateAdminUserDto } from '../../../apps/api/src/domain/admin-users/dto.js';

export type AdminUser = { id: string; email: string; name: string; role: string };
export type AdminFlagKey = 'scalar_docs' | 'pdf_builder' | 'self_signup';
export type AdminConfigItem = { key: AdminFlagKey; value: boolean };
export type AdminPutCall = { key: string; body: unknown };
export type ManagedAdminUser = { id: string; email: string; name: string | null; image: string | null; role: string; emailVerified: boolean; createdAt: string; disabledAt: string | null; projectCount: number };

export type AdminMockOptions = {
  user?: AdminUser | null;
  config?: AdminConfigItem[];
  failConfigGetCalls?: number[];
  failPutKeys?: string[];
  failHealthCalls?: number[];
  managedUsers?: ManagedAdminUser[];
  broadcasts?: BroadcastView[];
  loginActivity?: LoginEventView[];
  completeSetup?: boolean;
  mailFromEnvironment?: boolean;
};

export type AdminMockState = {
  configGetCalls: number;
  healthCalls: number;
  putCalls: AdminPutCall[];
  userListCalls: number;
  userMutations: string[];
  preferenceUpdates: unknown[];
  broadcastRequests: Array<{ method: string; path: string; body?: unknown }>;
  loginActivityCalls: number;
  setupRequests: Array<{ method: string; path: string; body?: unknown }>;
};

const DEFAULT_ADMIN: AdminUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'admin',
};

const DEFAULT_CONFIG: AdminConfigItem[] = [
  { key: 'scalar_docs', value: false },
  { key: 'pdf_builder', value: false },
  { key: 'self_signup', value: false },
];

async function json(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export async function setupAdminApiMock(page: Page, options: AdminMockOptions = {}): Promise<AdminMockState> {
  const user = options.user === undefined ? DEFAULT_ADMIN : options.user;
  const config = options.config?.map((item) => ({ ...item })) ?? DEFAULT_CONFIG.map((item) => ({ ...item }));
  const failConfigGetCalls = new Set(options.failConfigGetCalls ?? []);
  const failPutKeys = new Set(options.failPutKeys ?? []);
  const failHealthCalls = new Set(options.failHealthCalls ?? []);
  const managedUsers = options.managedUsers?.map((item) => ({ ...item })) ?? [{ id: 'member-1', email: 'member@example.test', name: 'Member', image: null, role: 'user', emailVerified: true, createdAt: '2026-10-01T00:00:00.000Z', disabledAt: null, projectCount: 2 }];
  const setupRequests: AdminMockState['setupRequests'] = [];
  const makeIntegration = (key: IntegrationKey, label: string): IntegrationItemView => {
    const configured = options.completeSetup !== false || (key === 'mail' && options.mailFromEnvironment === true);
    const source = configured ? key === 'mail' && options.mailFromEnvironment ? 'env' : 'database' : null;
    const mailSettings = key === 'mail' && configured ? { host: 'smtp.example.test', port: 587, secure: false, username: 'mailer', fromAddress: 'notices@example.test' } : null;
    return { key, label, configured, source, baseUrl: configured ? key === 'mail' ? 'smtp.example.test' : `https://${key}.example.test` : null, hasCredentials: configured, credentialHint: configured ? '••••1234' : null, settings: mailSettings, lastStatus: configured ? 'ok' : null, lastTestedAt: null, lastError: null };
  };
  const adminSetup = { complete: options.completeSetup !== false, integrations: [makeIntegration('uptime', 'Uptime Kuma'), makeIntegration('grafana', 'Grafana'), makeIntegration('mail', 'Mail')] };
  const updateSetupComplete = (): void => { adminSetup.complete = adminSetup.integrations.every((item) => item.configured && item.lastStatus === 'ok'); };
  const state: AdminMockState = { configGetCalls: 0, healthCalls: 0, putCalls: [], userListCalls: 0, userMutations: [], preferenceUpdates: [], broadcastRequests: [], loginActivityCalls: 0, setupRequests };
  const broadcasts = options.broadcasts?.map((item) => structuredClone(item)) ?? [];
  const loginActivity = options.loginActivity?.map((item) => ({ ...item })) ?? [];
  let themePreference = { themeMode: 'system' as const, themeAccent: 'slate' as const };

  const audienceFilterValid = (audience: string, value: unknown): boolean => {
    if (audience === 'all') return value === undefined;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const filter = value as Record<string, unknown>;
    if (audience === 'role') return Object.keys(filter).length === 1 && typeof filter['role'] === 'string' && filter['role'].trim().length > 0;
    const ids = filter['userIds'];
    return Object.keys(filter).length === 1 && Array.isArray(ids) && ids.length > 0 && ids.length <= 1000 && ids.every((id) => typeof id === 'string' && id.trim().length > 0);
  };

  await page.route('**/api/auth/get-session', async (route) => {
    await json(route, 200, user ? { user, session: { id: 'admin-session-1' } } : null);
  });
  await page.route('**/api/auth/sign-out', async (route) => {
    await json(route, 200, { success: true });
  });
  await page.route('**/me/preferences', async (route) => {
    const request = route.request();
    if (!user) { await json(route, 401, { error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }); return; }
    if (request.method() === 'GET') { await json(route, 200, { message: 'Preferences retrieved successfully', data: themePreference, success: true }); return; }
    if (request.method() === 'PATCH') {
      let body: unknown;
      try { body = request.postDataJSON(); } catch { body = undefined; }
      const parsed = updateThemePreferencesDto.safeParse(body);
      if (!parsed.success) { await json(route, 400, { error: { code: 'VALIDATION', message: 'Invalid theme preference' } }); return; }
      state.preferenceUpdates.push(parsed.data);
      themePreference = { ...themePreference, ...parsed.data };
      await json(route, 200, { message: 'Preferences updated successfully', data: themePreference, success: true });
      return;
    }
    await json(route, 404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
  });
  await page.route('**/admin/config**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname === '/admin/config') {
      state.configGetCalls += 1;
      if (!user || user.role !== 'admin') {
        await json(route, 403, { error: { code: 'FORBIDDEN', message: 'Administrator access required' } });
        return;
      }
      if (failConfigGetCalls.has(state.configGetCalls)) {
        await json(route, 500, { error: { code: 'INTERNAL', message: 'Configuration service unavailable' } });
        return;
      }
      await json(route, 200, { message: 'System config retrieved successfully', data: config, success: true });
      return;
    }

    const key = url.pathname.split('/').at(-1) ?? '';
    if (request.method() === 'PUT') {
      const body = request.postDataJSON() as unknown;
      state.putCalls.push({ key, body });
      if (!user || user.role !== 'admin') {
        await json(route, 403, { error: { code: 'FORBIDDEN', message: 'Administrator access required' } });
        return;
      }
      if (failPutKeys.has(key)) {
        await json(route, 400, { error: { code: 'VALIDATION', message: 'Configuration update failed' } });
        return;
      }
      const parsed = updateSystemConfigDto.safeParse(body);
      if (!parsed.success) {
        await json(route, 400, { error: { code: 'VALIDATION', message: 'value must be a boolean' } });
        return;
      }
      const value = parsed.data.value;
      const existing = config.find((item) => item.key === key);
      if (existing) existing.value = value;
      await json(route, 200, {
        message: 'System config updated successfully',
        data: { key, value },
        success: true,
      });
      return;
    }
    await json(route, 404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
  });
  await page.route('**/admin/setup**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!user || user.role !== 'admin') { await json(route, 403, { error: { code: 'FORBIDDEN', message: 'Administrator access required' } }); return; }
    if (path === '/admin/setup' && request.method() === 'GET') {
      setupRequests.push({ method: 'GET', path });
      const parsed = adminSetupViewDto.safeParse(adminSetup);
      if (!parsed.success) { await json(route, 500, { error: { code: 'INTERNAL', message: 'Invalid setup fixture' } }); return; }
      await json(route, 200, { message: 'Admin setup retrieved', data: parsed.data, success: true }); return;
    }
    const match = path.match(/^\/admin\/setup\/(uptime|grafana|mail)(?:\/(test))?$/);
    if (!match) { await json(route, 404, { error: { code: 'NOT_FOUND', message: 'Integration not found' } }); return; }
    const key = match[1] as IntegrationKey;
    const item = adminSetup.integrations.find((integration) => integration.key === key);
    if (!item) { await json(route, 404, { error: { code: 'NOT_FOUND', message: 'Integration not found' } }); return; }
    if (request.method() === 'PUT' && !match[2]) {
      let body: unknown; try { body = request.postDataJSON(); } catch { body = undefined; }
      const schema = key === 'uptime' ? updateUptimeIntegrationDto : key === 'grafana' ? updateGrafanaIntegrationDto : updateMailIntegrationDto;
      const parsed = schema.safeParse(body);
      setupRequests.push({ method: 'PUT', path, body });
      if (!parsed.success) { await json(route, 400, { error: { code: 'VALIDATION', message: 'Invalid integration settings' } }); return; }
      item.configured = true; item.source = 'database'; item.lastStatus = null; item.lastError = null;
      item.baseUrl = key === 'mail' ? (parsed.data as { host: string }).host : (parsed.data as { baseUrl: string }).baseUrl;
      if (key === 'mail') {
        const mail = parsed.data as { host: string; port: number; secure: boolean; username?: string; fromAddress: string };
        item.settings = { host: mail.host, port: mail.port, secure: mail.secure, username: mail.username ?? null, fromAddress: mail.fromAddress };
      }
      const credentials = parsed.data as { password?: string; apiKey?: string; apiToken?: string };
      item.hasCredentials = Boolean(credentials.password || credentials.apiKey || credentials.apiToken || item.hasCredentials);
      item.credentialHint = item.hasCredentials ? '••••1234' : null;
      updateSetupComplete();
      await json(route, 200, { message: 'Integration configured', data: item, success: true }); return;
    }
    if (request.method() === 'POST' && match[2] === 'test') {
      if ((request.postDataBuffer()?.length ?? 0) > 0) { await json(route, 400, { error: { code: 'VALIDATION', message: 'Request body must be empty' } }); return; }
      setupRequests.push({ method: 'POST', path });
      item.lastStatus = item.configured ? 'ok' : 'failed'; item.lastError = item.configured ? null : 'Integration is not configured'; updateSetupComplete();
      await json(route, 200, { message: 'Integration test executed', data: item, success: true }); return;
    }
    if (request.method() === 'DELETE' && !match[2]) {
      setupRequests.push({ method: 'DELETE', path });
      const cleared = makeIntegration(key, item.label);
      Object.assign(item, cleared); updateSetupComplete();
      await json(route, 200, { message: 'Integration cleared', data: item, success: true }); return;
    }
    await json(route, 404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
  });
  await page.route('**/admin/broadcasts**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    if (!user || user.role !== 'admin') { await json(route, 403, { error: { code: 'FORBIDDEN', message: 'Administrator access required' } }); return; }
    if (path === '/admin/broadcasts' && request.method() === 'GET') {
      const query = listBroadcastsQueryDto.safeParse(Object.fromEntries(url.searchParams.entries()));
      if (!query.success) { await json(route, 400, { error: { code: 'VALIDATION', message: 'Invalid broadcast query' } }); return; }
      const q = query.data.q?.toLowerCase() ?? '';
      const matches = broadcasts.filter((item) => `${item.subject} ${item.status}`.toLowerCase().includes(q));
      if (matches.some((item) => !broadcastViewDto.safeParse(item).success)) { await json(route, 500, { error: { code: 'INTERNAL', message: 'Invalid broadcast fixture' } }); return; }
      const start = (query.data.page - 1) * query.data.limit;
      await json(route, 200, { message: 'Broadcasts retrieved successfully', data: matches.slice(start, start + query.data.limit), metadata: { page: query.data.page, limit: query.data.limit, total: matches.length }, success: true }); return;
    }
    if (path === '/admin/broadcasts' && request.method() === 'POST') {
      let body: unknown; try { body = request.postDataJSON(); } catch { body = undefined; }
      const parsed = createBroadcastDto.safeParse(body);
      state.broadcastRequests.push({ method: 'POST', path, body });
      if (!parsed.success || !audienceFilterValid(parsed.data.audience, parsed.data.audienceFilter)) { await json(route, 400, { error: { code: 'VALIDATION', message: 'Invalid broadcast body' } }); return; }
      const now = new Date().toISOString(); const item: BroadcastView = { id: `broadcast-${broadcasts.length + 1}`, subject: parsed.data.subject, bodyText: parsed.data.bodyText, audience: parsed.data.audience, audienceFilter: (parsed.data.audienceFilter as Record<string, unknown> | undefined) ?? null, status: 'draft', sentAt: null, createdBy: user.id, counts: { total: 0, sent: 0, failed: 0 }, createdAt: now, updatedAt: now };
      if (!broadcastViewDto.safeParse(item).success) { await json(route, 500, { error: { code: 'INTERNAL', message: 'Invalid broadcast response fixture' } }); return; }
      broadcasts.unshift(item); await json(route, 201, { message: 'Broadcast created successfully', data: item, success: true }); return;
    }
    const match = path.match(/^\/admin\/broadcasts\/([^/]+)(?:\/(preview|send))?$/);
    if (!match) { await json(route, 404, { error: { code: 'NOT_FOUND', message: 'Broadcast not found' } }); return; }
    const item = broadcasts.find((entry) => entry.id === decodeURIComponent(match[1]));
    if (!item) { await json(route, 404, { error: { code: 'NOT_FOUND', message: 'Broadcast not found' } }); return; }
    if (request.method() === 'GET' && !match[2]) { await json(route, 200, { message: 'Broadcast retrieved successfully', data: item, success: true }); return; }
    if (request.method() === 'PATCH' && !match[2]) {
      let body: unknown; try { body = request.postDataJSON(); } catch { body = undefined; }
      const parsed = updateBroadcastDto.safeParse(body); state.broadcastRequests.push({ method: 'PATCH', path, body });
      const nextAudience = parsed.success ? parsed.data.audience ?? item.audience : item.audience;
      if (!parsed.success || item.status !== 'draft' || (parsed.data.audienceFilter !== undefined && !audienceFilterValid(nextAudience, parsed.data.audienceFilter)) || (parsed.data.audience === 'all' && parsed.data.audienceFilter !== undefined)) { await json(route, 400, { error: { code: item.status === 'sent' ? 'BROADCAST_ALREADY_SENT' : 'VALIDATION', message: 'Invalid broadcast update' } }); return; }
      Object.assign(item, parsed.data); item.updatedAt = new Date().toISOString(); await json(route, 200, { message: 'Broadcast updated successfully', data: item, success: true }); return;
    }
    if (request.method() === 'DELETE' && !match[2]) {
      state.broadcastRequests.push({ method: 'DELETE', path }); broadcasts.splice(broadcasts.indexOf(item), 1); await json(route, 200, { message: 'Broadcast deleted successfully', data: null, success: true }); return;
    }
    if (request.method() === 'POST' && match[2] === 'preview') {
      if (request.postDataBuffer()?.length) { await json(route, 400, { error: { code: 'VALIDATION', message: 'Request body must be empty' } }); return; }
      state.broadcastRequests.push({ method: 'POST', path }); await json(route, 200, { message: 'Broadcast preview created successfully', data: { recipientCount: 2, sampleEmails: ['a***@example.test', 'b***@example.test'], renderedSubject: item.subject, renderedBodyText: item.bodyText }, success: true }); return;
    }
    if (request.method() === 'POST' && match[2] === 'send') {
      if (request.postDataBuffer()?.length) { await json(route, 400, { error: { code: 'VALIDATION', message: 'Request body must be empty' } }); return; }
      if (item.status === 'sent') { await json(route, 409, { error: { code: 'BROADCAST_ALREADY_SENT', message: 'Broadcast already sent' } }); return; }
      state.broadcastRequests.push({ method: 'POST', path }); item.status = 'sent'; item.sentAt = new Date().toISOString(); item.counts = { total: 2, sent: 2, failed: 0 }; item.updatedAt = item.sentAt; await json(route, 200, { message: 'Broadcast sent successfully', data: item, success: true }); return;
    }
    await json(route, 404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
  });
  await page.route('**/admin/login-activity**', async (route) => {
    const url = new URL(route.request().url());
    if (!user || user.role !== 'admin') { await json(route, 403, { error: { code: 'FORBIDDEN', message: 'Administrator access required' } }); return; }
    const query = listAdminLoginActivityQueryDto.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!query.success) { await json(route, 400, { error: { code: 'VALIDATION', message: 'Invalid login activity query' } }); return; }
    state.loginActivityCalls += 1;
    const q = query.data.q?.toLowerCase() ?? '';
    const matches = loginActivity.filter((event) => `${event.userEmail ?? ''} ${event.userName ?? ''} ${event.ip ?? ''} ${event.country ?? ''} ${event.city ?? ''}`.toLowerCase().includes(q));
    if (matches.some((event) => !loginEventViewDto.safeParse(event).success)) { await json(route, 500, { error: { code: 'INTERNAL', message: 'Invalid login activity fixture' } }); return; }
    const start = (query.data.page - 1) * query.data.limit;
    await json(route, 200, { message: 'Login activity retrieved successfully', data: matches.slice(start, start + query.data.limit), metadata: { page: query.data.page, limit: query.data.limit, total: matches.length }, success: true });
  });
  await page.route('**/admin/users**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    if (!user || user.role !== 'admin') {
      await json(route, 403, { error: { code: 'FORBIDDEN', message: 'Administrator access required' } });
      return;
    }
    if (pathname === '/admin/users' && request.method() === 'GET') {
      const parsedQuery = listAdminUsersQueryDto.safeParse(Object.fromEntries(url.searchParams.entries()));
      if (!parsedQuery.success) { await json(route, 400, { error: { code: 'VALIDATION', message: 'Invalid user list query' } }); return; }
      state.userListCalls += 1;
      const query = parsedQuery.data.q?.toLowerCase() ?? '';
      const data = managedUsers.filter((item) => `${item.name ?? ''} ${item.email}`.toLowerCase().includes(query));
      if (data.some((item) => !adminUserViewSchema.safeParse(item).success)) { await json(route, 500, { error: { code: 'INTERNAL', message: 'Invalid user fixture' } }); return; }
      const start = (parsedQuery.data.page - 1) * parsedQuery.data.limit;
      await json(route, 200, { message: 'Users retrieved successfully', data: data.slice(start, start + parsedQuery.data.limit), metadata: { page: parsedQuery.data.page, limit: parsedQuery.data.limit, total: data.length }, success: true });
      return;
    }
    const match = pathname.match(/^\/admin\/users\/([^/]+)(?:\/(disable|enable))?$/);
    if (!match) { await json(route, 404, { error: { code: 'NOT_FOUND', message: 'User not found' } }); return; }
    const target = managedUsers.find((item) => item.id === decodeURIComponent(match[1]));
    if (!target) { await json(route, 404, { error: { code: 'NOT_FOUND', message: 'User not found' } }); return; }
    if (request.method() === 'GET' && !match[2]) {
      await json(route, 200, { message: 'User retrieved successfully', data: target, success: true });
      return;
    }
    if (request.method() === 'PATCH' && !match[2]) {
      let body: unknown;
      try { body = request.postDataJSON(); } catch { body = undefined; }
      const parsed = updateAdminUserDto.safeParse(body);
      if (!parsed.success) {
        await json(route, 400, { error: { code: 'VALIDATION', message: 'Invalid user update' } });
        return;
      }
      const update = parsed.data;
      if (typeof update.name === 'string') target.name = update.name;
      if (update.image === null || typeof update.image === 'string') target.image = update.image;
      state.userMutations.push('PATCH');
      await json(route, 200, { message: 'User updated successfully', data: target, success: true });
      return;
    }
    if (request.method() === 'POST' && match[2]) {
      let body: unknown;
      try { body = request.postDataJSON(); } catch { body = undefined; }
      const actionBodyValid = match[2] === 'enable'
        ? z.strictObject({}).safeParse(body).success
        : disableUserDto.safeParse(body).success;
      if (!actionBodyValid) {
        await json(route, 400, { error: { code: 'VALIDATION', message: 'Invalid action body' } });
        return;
      }
      target.disabledAt = match[2] === 'disable' ? '2026-11-09T00:00:00.000Z' : null;
      state.userMutations.push(match[2]);
      await json(route, 200, { message: `User ${match[2]}d successfully`, data: target, success: true });
      return;
    }
    await json(route, 404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
  });
  await page.route('**/health', async (route) => {
    state.healthCalls += 1;
    if (failHealthCalls.has(state.healthCalls)) {
      await json(route, 503, { error: { code: 'UNAVAILABLE', message: 'Health check failed' } });
      return;
    }
    await json(route, 200, { status: 'ok' });
  });

  return state;
}
