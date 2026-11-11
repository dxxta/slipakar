import { z } from 'zod';
import { createEmbedTokenDto } from '../../../domain/embed/dto.js';
import type { RouteDoc } from '../../../domain/openapi/interface.js';

export const embedRoutes: RouteDoc[] = [
  { method: 'post', path: '/projects/:projectId/embed-tokens', tag: 'Embedding', summary: 'Create a single-use embed launch token', auth: 'public', status: 201, body: createEmbedTokenDto, data: z.object({ token: z.string(), url: z.string().url(), expiresAt: z.string().datetime() }), apiKeyScope: 'embed:create', integrationOnly: true },
];
