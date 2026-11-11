import { createSmtpDto, listSmtpQueryDto, updateSmtpDto } from '../../../domain/smtp/dto.js';
import type { RouteDoc } from '../../../domain/openapi/interface.js';

export const smtpRoutes: RouteDoc[] = [
  {
    method: 'post',
    path: '/projects/:projectId/smtp',
    tag: 'SMTP',
    summary: 'Create SMTP connection',
    auth: 'session',
    status: 201,
    body: createSmtpDto,
  },
  {
    method: 'get',
    path: '/projects/:projectId/smtp',
    tag: 'SMTP',
    summary: 'List SMTP connections',
    auth: 'session',
    apiKeyScope: 'smtp:read',
    status: 200,
    query: listSmtpQueryDto,
  },
  {
    method: 'get',
    path: '/projects/:projectId/smtp/:id',
    tag: 'SMTP',
    summary: 'Get SMTP connection by ID',
    auth: 'session',
    status: 200,
  },
  {
    method: 'patch',
    path: '/projects/:projectId/smtp/:id',
    tag: 'SMTP',
    summary: 'Update SMTP connection',
    auth: 'session',
    status: 200,
    body: updateSmtpDto,
  },
  {
    method: 'delete',
    path: '/projects/:projectId/smtp/:id',
    tag: 'SMTP',
    summary: 'Delete SMTP connection',
    auth: 'session',
    status: 200,
  },
  {
    method: 'post',
    path: '/projects/:projectId/smtp/:id/test',
    tag: 'SMTP',
    summary: 'Test SMTP connection',
    auth: 'session',
    status: 200,
  },
];
