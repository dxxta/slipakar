import { createMappingDto, getMappingDto, previewMappingDto } from '../../../domain/mapping/dto.js';
import type { RouteDoc } from '../../../domain/openapi/interface.js';

export const mappingRoutes: RouteDoc[] = [
  {
    method: 'put',
    path: '/projects/:projectId/mappings',
    tag: 'Mapping',
    summary: 'Save field mapping',
    auth: 'session',
    apiKeyScope: 'mappings:write',
    status: 200,
    body: createMappingDto,
  },
  {
    method: 'get',
    path: '/projects/:projectId/mappings',
    tag: 'Mapping',
    summary: 'Get field mapping',
    auth: 'session',
    apiKeyScope: 'mappings:read',
    status: 200,
    query: getMappingDto,
  },
  {
    method: 'post',
    path: '/projects/:projectId/preview',
    tag: 'Mapping',
    summary: 'Preview rendered template with mapped row',
    auth: 'session',
    status: 200,
    body: previewMappingDto,
  },
];
