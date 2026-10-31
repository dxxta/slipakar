import { createAttachmentsDto } from '../../../domain/attachments/dto.js';
import type { RouteDoc } from '../../../domain/openapi/interface.js';

export const attachmentsRoutes: RouteDoc[] = [
  {
    method: 'post',
    path: '/projects/:projectId/attachments',
    tag: 'Attachments',
    summary: 'Upload project attachment',
    auth: 'session',
    status: 201,
    multipart: true,
    body: createAttachmentsDto,
  },
  {
    method: 'get',
    path: '/projects/:projectId/attachments',
    tag: 'Attachments',
    summary: 'List project attachments',
    auth: 'session',
    status: 200,
  },
  {
    method: 'delete',
    path: '/projects/:projectId/attachments/:id',
    tag: 'Attachments',
    summary: 'Delete project attachment',
    auth: 'session',
    status: 200,
  },
  {
    method: 'get',
    path: '/projects/:projectId/storage',
    tag: 'Attachments',
    summary: 'Get project storage usage and quota',
    auth: 'session',
    status: 200,
  },
];
