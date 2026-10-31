import { createCampaignsDto, listCampaignsQueryDto, listRecipientsQueryDto } from '../../../domain/campaigns/dto.js';
import type { RouteDoc } from '../../../domain/openapi/interface.js';

export const campaignsRoutes: RouteDoc[] = [
  {
    method: 'post',
    path: '/projects/:projectId/campaigns',
    tag: 'Campaigns',
    summary: 'Create campaign with recipients',
    auth: 'session',
    status: 201,
    body: createCampaignsDto,
  },
  {
    method: 'get',
    path: '/projects/:projectId/campaigns',
    tag: 'Campaigns',
    summary: 'List project campaigns',
    auth: 'session',
    status: 200,
    query: listCampaignsQueryDto,
  },
  {
    method: 'get',
    path: '/projects/:projectId/campaigns/:id',
    tag: 'Campaigns',
    summary: 'Get campaign details with status counts',
    auth: 'session',
    status: 200,
  },
  {
    method: 'post',
    path: '/projects/:projectId/campaigns/:id/send',
    tag: 'Campaigns',
    summary: 'Trigger campaign sending',
    auth: 'session',
    status: 202,
  },
  {
    method: 'get',
    path: '/projects/:projectId/campaigns/:id/recipients',
    tag: 'Campaigns',
    summary: 'Get paginated campaign recipients',
    auth: 'session',
    status: 200,
    query: listRecipientsQueryDto,
  },
  {
    method: 'post',
    path: '/projects/:projectId/campaigns/:campaignId/recipients/:recipientId/retry',
    tag: 'Campaigns',
    summary: 'Retry sending to a failed recipient',
    auth: 'session',
    status: 200,
  },
];
