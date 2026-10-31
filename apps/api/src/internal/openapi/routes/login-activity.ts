import { z } from 'zod';
import type { RouteDoc } from '../../../domain/openapi/interface.js';
import { loginEventViewDto } from '../../../domain/login-activity/dto.js';

export const loginActivityRoutes: RouteDoc[] = [
  {
    method: 'get',
    path: '/me/login-activity',
    summary: 'Get current user login activity history',
    tag: 'Login Activity',
    auth: 'session',
    status: 200,
    data: z.array(loginEventViewDto),
  },
  {
    method: 'get',
    path: '/admin/login-activity',
    summary: 'Get all user login activity history (admin only)',
    tag: 'Login Activity',
    auth: 'admin',
    status: 200,
    data: z.array(loginEventViewDto),
  },
];
