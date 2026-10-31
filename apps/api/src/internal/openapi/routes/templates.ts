import { createTemplateDto, listTemplatesQueryDto, updateTemplateDto } from '../../../domain/templates/dto.js';
import type { RouteDoc } from '../../../domain/openapi/interface.js';

export const templatesRoutes: RouteDoc[] = [
  {
    method: 'post',
    path: '/projects/:projectId/templates',
    tag: 'Templates',
    summary: 'Create email template',
    auth: 'session',
    status: 201,
    body: createTemplateDto,
  },
  {
    method: 'get',
    path: '/projects/:projectId/templates',
    tag: 'Templates',
    summary: 'List email templates',
    auth: 'session',
    status: 200,
    query: listTemplatesQueryDto,
  },
  {
    method: 'get',
    path: '/projects/:projectId/templates/:id',
    tag: 'Templates',
    summary: 'Get email template by ID',
    auth: 'session',
    status: 200,
  },
  {
    method: 'patch',
    path: '/projects/:projectId/templates/:id',
    tag: 'Templates',
    summary: 'Update email template',
    auth: 'session',
    status: 200,
    body: updateTemplateDto,
  },
  {
    method: 'delete',
    path: '/projects/:projectId/templates/:id',
    tag: 'Templates',
    summary: 'Delete email template',
    auth: 'session',
    status: 200,
  },
];
