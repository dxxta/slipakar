import { z } from 'zod';
import type { RouteDoc } from '../../../domain/openapi/interface.js';
import {
  adminUserViewSchema,
  disableUserDto,
  listAdminUsersQueryDto,
  updateAdminUserDto,
} from '../../../domain/admin-users/dto.js';

export const adminUsersRoutes: RouteDoc[] = [
  {
    method: 'get',
    path: '/admin/users',
    tag: 'Admin Users',
    summary: 'List users with pagination and search',
    auth: 'admin',
    status: 200,
    query: listAdminUsersQueryDto,
    data: z.array(adminUserViewSchema),
  },
  {
    method: 'get',
    path: '/admin/users/:id',
    tag: 'Admin Users',
    summary: 'Get user details by ID',
    auth: 'admin',
    status: 200,
    data: adminUserViewSchema,
  },
  {
    method: 'patch',
    path: '/admin/users/:id',
    tag: 'Admin Users',
    summary: 'Update user name or image',
    auth: 'admin',
    status: 200,
    body: updateAdminUserDto,
    data: adminUserViewSchema,
  },
  {
    method: 'post',
    path: '/admin/users/:id/disable',
    tag: 'Admin Users',
    summary: 'Disable user and revoke active sessions',
    auth: 'admin',
    status: 200,
    body: disableUserDto,
    data: adminUserViewSchema,
  },
  {
    method: 'post',
    path: '/admin/users/:id/enable',
    tag: 'Admin Users',
    summary: 'Re-enable a disabled user account',
    auth: 'admin',
    status: 200,
    data: adminUserViewSchema,
  },
];
