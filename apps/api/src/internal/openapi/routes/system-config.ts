import { updateSystemConfigDto } from '../../../domain/system-config/dto.js';
import type { RouteDoc } from '../../../domain/openapi/interface.js';

export const systemConfigRoutes: RouteDoc[] = [
  {
    method: 'get',
    path: '/admin/config',
    tag: 'System Config',
    summary: 'Get all system config feature flags',
    auth: 'admin',
    status: 200,
  },
  {
    method: 'put',
    path: '/admin/config/:key',
    tag: 'System Config',
    summary: 'Update a system config feature flag',
    auth: 'admin',
    status: 200,
    body: updateSystemConfigDto,
  },
];
