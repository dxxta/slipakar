import { z } from 'zod';
import type { RouteDoc } from '../../../domain/openapi/interface.js';

export const demoProjectRoutes: RouteDoc[] = [
  {
    method: 'post',
    path: '/admin/demo-project',
    tag: 'Demo Project',
    summary: 'Seed an example payroll demo project',
    auth: 'admin',
    status: 200,
    data: z.object({
      projectId: z.string().uuid(),
      created: z.boolean(),
    }),
  },
];
