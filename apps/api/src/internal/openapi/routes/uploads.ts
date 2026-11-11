import type { RouteDoc } from '../../../domain/openapi/interface.js';

export const uploadsRoutes: RouteDoc[] = [
  {
    method: 'post',
    path: '/projects/:projectId/uploads',
    tag: 'Uploads',
    summary: 'Upload data file',
    auth: 'session',
    apiKeyScope: 'uploads:write',
    status: 201,
    multipart: true,
  },
  {
    method: 'get',
    path: '/projects/:projectId/uploads',
    tag: 'Uploads',
    summary: 'List data uploads',
    auth: 'session',
    apiKeyScope: 'uploads:read',
    status: 200,
  },
  {
    method: 'get',
    path: '/projects/:projectId/uploads/:id',
    tag: 'Uploads',
    summary: 'Get data upload metadata and preview',
    auth: 'session',
    apiKeyScope: 'uploads:read',
    status: 200,
  },
  {
    method: 'delete',
    path: '/projects/:projectId/uploads/:id',
    tag: 'Uploads',
    summary: 'Delete data upload',
    auth: 'session',
    apiKeyScope: 'uploads:write',
    status: 200,
  },
];
