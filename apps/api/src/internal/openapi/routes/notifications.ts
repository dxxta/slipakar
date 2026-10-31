import { z } from 'zod';
import {
  listNotificationsQueryDto,
  notificationCountSchema,
  notificationViewSchema,
} from '../../../domain/notifications/dto.js';
import type { RouteDoc } from '../../../domain/openapi/interface.js';

export const notificationsRoutes: RouteDoc[] = [
  {
    method: 'get',
    path: '/projects/:projectId/notifications',
    tag: 'Notifications',
    summary: 'List project notifications',
    auth: 'session',
    status: 200,
    query: listNotificationsQueryDto,
    data: z.array(notificationViewSchema),
  },
  {
    method: 'post',
    path: '/projects/:projectId/notifications/:id/read',
    tag: 'Notifications',
    summary: 'Mark a project notification as read',
    auth: 'session',
    status: 200,
    data: notificationViewSchema,
  },
  {
    method: 'post',
    path: '/projects/:projectId/notifications/read-all',
    tag: 'Notifications',
    summary: 'Mark all unread notifications in a project as read',
    auth: 'session',
    status: 200,
    data: notificationCountSchema,
  },
  {
    method: 'get',
    path: '/notifications/unread-count',
    tag: 'Notifications',
    summary: 'Get the signed-in user unread notification count',
    auth: 'session',
    status: 200,
    data: notificationCountSchema,
  },
];
