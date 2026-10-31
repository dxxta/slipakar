import { z } from 'zod';
import type { RouteDoc } from '../../../domain/openapi/interface.js';
import {
  adminSetupViewDto,
  integrationItemViewDto,
  mailTestSendDto,
  updateIntegrationDto,
} from '../../../domain/admin-setup/dto.js';

export const adminSetupRoutes: RouteDoc[] = [
  {
    method: 'get',
    path: '/admin/setup',
    tag: 'Admin Setup',
    summary: 'Get admin setup checklist and integration status',
    auth: 'admin',
    status: 200,
    data: adminSetupViewDto,
  },
  {
    method: 'put',
    path: '/admin/setup/:key',
    tag: 'Admin Setup',
    summary: 'Configure an external integration (uptime, grafana, or mail)',
    auth: 'admin',
    status: 200,
    body: updateIntegrationDto,
    data: integrationItemViewDto,
  },
  {
    method: 'delete',
    path: '/admin/setup/:key',
    tag: 'Admin Setup',
    summary: 'Clear an external integration configuration',
    auth: 'admin',
    status: 200,
    data: integrationItemViewDto,
  },
  {
    method: 'post',
    path: '/admin/setup/mail/test-send',
    tag: 'Admin Setup',
    summary: 'Send a test email to verify platform mailer configuration',
    auth: 'admin',
    status: 200,
    body: mailTestSendDto,
    data: z.strictObject({
      ok: z.boolean(),
      error: z.string().optional(),
    }),
  },
  {
    method: 'post',
    path: '/admin/setup/:key/test',
    tag: 'Admin Setup',
    summary: 'Test connectivity and authentication for an integration',
    auth: 'admin',
    status: 200,
    data: integrationItemViewDto,
  },
];
