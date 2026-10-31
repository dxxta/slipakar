import { z } from 'zod';
import type { RouteDoc } from '../../../domain/openapi/interface.js';

export const avatarRoutes: RouteDoc[] = [
  {
    method: 'post',
    path: '/me/avatar',
    tag: 'Avatar',
    summary: 'Upload user profile avatar',
    auth: 'session',
    status: 200,
    multipart: true,
    data: z.object({
      url: z.string(),
    }),
  },
  {
    method: 'get',
    path: '/me/avatar/:userId',
    tag: 'Avatar',
    summary: 'Stream user profile avatar',
    auth: 'session',
    status: 200,
  },
  {
    method: 'delete',
    path: '/me/avatar',
    tag: 'Avatar',
    summary: 'Delete user profile avatar',
    auth: 'session',
    status: 200,
  },
];
