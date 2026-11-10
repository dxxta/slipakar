import { createPdfTemplatesDto, listPdfTemplatesQueryDto, previewPdfTemplatesDto, updatePdfTemplatesDto } from '../../../domain/pdf-templates/dto.js';
import type { RouteDoc } from '../../../domain/openapi/interface.js';

export const pdfTemplatesRoutes: RouteDoc[] = [
  {
    method: 'post',
    path: '/projects/:projectId/pdf-templates/preview',
    tag: 'PDF Templates',
    summary: 'Render a PDF preview of an unsaved node tree',
    auth: 'session',
    status: 200,
    body: previewPdfTemplatesDto,
  },
  {
    method: 'post',
    path: '/projects/:projectId/pdf-templates',
    tag: 'PDF Templates',
    summary: 'Create PDF template',
    auth: 'session',
    status: 201,
    body: createPdfTemplatesDto,
  },
  {
    method: 'get',
    path: '/projects/:projectId/pdf-templates',
    tag: 'PDF Templates',
    summary: 'List PDF templates',
    auth: 'session',
    status: 200,
    query: listPdfTemplatesQueryDto,
  },
  {
    method: 'get',
    path: '/projects/:projectId/pdf-templates/:id',
    tag: 'PDF Templates',
    summary: 'Get PDF template by ID',
    auth: 'session',
    status: 200,
  },
  {
    method: 'patch',
    path: '/projects/:projectId/pdf-templates/:id',
    tag: 'PDF Templates',
    summary: 'Update PDF template',
    auth: 'session',
    status: 200,
    body: updatePdfTemplatesDto,
  },
  {
    method: 'delete',
    path: '/projects/:projectId/pdf-templates/:id',
    tag: 'PDF Templates',
    summary: 'Delete PDF template',
    auth: 'session',
    status: 200,
  },
];
