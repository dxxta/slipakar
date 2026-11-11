import { z } from 'zod';
import { createApiKeyDto } from '../../../domain/apikeys/dto.js';
import type { RouteDoc } from '../../../domain/openapi/interface.js';
const keyView = z.object({ id: z.string(), projectId: z.string(), name: z.string(), prefix: z.string(), scopes: z.array(z.string()), expiresAt: z.string().nullable(), revokedAt: z.string().nullable(), lastUsedAt: z.string().nullable(), createdAt: z.string() });
export const apiKeysRoutes: RouteDoc[] = [
  { method: 'get', path: '/projects/:projectId/api-keys', tag: 'API keys', summary: 'List project API keys', auth: 'session', status: 200, data: z.array(keyView) },
  { method: 'post', path: '/projects/:projectId/api-keys', tag: 'API keys', summary: 'Create a project API key (secret shown once)', auth: 'session', status: 201, body: createApiKeyDto, data: keyView.extend({ secret: z.string() }) },
  { method: 'delete', path: '/projects/:projectId/api-keys/:id', tag: 'API keys', summary: 'Revoke a project API key', auth: 'session', status: 200, data: keyView },
];

export const apiAccessRoutes: RouteDoc[] = [
  { method: 'get', path: '/me/api-access', tag: 'API access', summary: 'Get API access status for the signed-in owner', auth: 'session', status: 200 },
  { method: 'get', path: '/admin/api-access', tag: 'API access', summary: 'Get API access environment and runtime settings', auth: 'admin', status: 200 },
];
