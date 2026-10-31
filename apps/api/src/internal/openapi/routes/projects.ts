import { z } from 'zod';
import { createProjectsDto, listProjectsQueryDto, updateProjectsDto } from '../../../domain/projects/dto.js';
import { listActivityQueryDto, auditLogViewSchema } from '../../../domain/audit/dto.js';
import type { RouteDoc } from '../../../domain/openapi/interface.js';

export const projectsRoutes: RouteDoc[] = [
  {
    method: 'post',
    path: '/projects',
    tag: 'Projects',
    summary: 'Create a new project',
    auth: 'session',
    status: 201,
    body: createProjectsDto,
  },
  {
    method: 'get',
    path: '/projects',
    tag: 'Projects',
    summary: 'List user projects',
    auth: 'session',
    status: 200,
    query: listProjectsQueryDto,
  },
  {
    method: 'get',
    path: '/projects/:projectId/activity',
    tag: 'Projects',
    summary: 'List project activity audit log',
    auth: 'session',
    status: 200,
    query: listActivityQueryDto,
    data: z.array(auditLogViewSchema),
  },
  {
    method: 'get',
    path: '/projects/:id',
    tag: 'Projects',
    summary: 'Get single project by ID',
    auth: 'session',
    status: 200,
  },
  {
    method: 'patch',
    path: '/projects/:id',
    tag: 'Projects',
    summary: 'Update project by ID',
    auth: 'session',
    status: 200,
    body: updateProjectsDto,
  },
  {
    method: 'delete',
    path: '/projects/:id',
    tag: 'Projects',
    summary: 'Delete project by ID',
    auth: 'session',
    status: 200,
  },
];
