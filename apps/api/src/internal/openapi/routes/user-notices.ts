import { z } from 'zod';
import type { RouteDoc } from '../../../domain/openapi/interface.js';
import { userNoticeViewDto } from '../../../domain/user-notices/dto.js';

export const userNoticeRoutes: RouteDoc[] = [
  {
    method: 'get',
    path: '/me/notices',
    summary: 'List user notices',
    tag: 'User Notices',
    auth: 'session',
    status: 200,
    data: z.array(userNoticeViewDto),
  },
  {
    method: 'get',
    path: '/me/notices/unread-count',
    summary: 'Get unread user notice count',
    tag: 'User Notices',
    auth: 'session',
    status: 200,
    data: z.strictObject({ unreadCount: z.number().int() }),
  },
  {
    method: 'patch',
    path: '/me/notices/:id/read',
    summary: 'Mark a notice as read',
    tag: 'User Notices',
    auth: 'session',
    status: 200,
    data: userNoticeViewDto,
  },
  {
    method: 'post',
    path: '/me/notices/mark-all-read',
    summary: 'Mark all user notices as read',
    tag: 'User Notices',
    auth: 'session',
    status: 200,
    data: z.strictObject({ updatedCount: z.number().int() }),
  },
];
