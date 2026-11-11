import type { RouteDoc } from '../../../domain/openapi/interface.js';
import { adminSetupRoutes } from './admin-setup.js';
import { apiAccessRoutes, apiKeysRoutes } from './api-keys.js';
import { adminUsersRoutes } from './admin-users.js';
import { attachmentsRoutes } from './attachments.js';
import { avatarRoutes } from './avatar.js';
import { broadcastRoutes } from './broadcasts.js';
import { campaignsRoutes } from './campaigns.js';
import { demoProjectRoutes } from './demo-project.js';
import { loginActivityRoutes } from './login-activity.js';
import { mappingRoutes } from './mapping.js';
import { notificationsRoutes } from './notifications.js';
import { pdfTemplatesRoutes } from './pdf-templates.js';
import { preferencesRoutes } from './preferences.js';
import { projectsRoutes } from './projects.js';
import { smtpRoutes } from './smtp.js';
import { systemConfigRoutes } from './system-config.js';
import { templatesRoutes } from './templates.js';
import { uploadsRoutes } from './uploads.js';
import { userNoticeRoutes } from './user-notices.js';

export const allRouteDocs: RouteDoc[] = [
  ...loginActivityRoutes,
  ...apiKeysRoutes,
  ...apiAccessRoutes,
  ...preferencesRoutes,
  ...userNoticeRoutes,
  ...avatarRoutes,
  ...projectsRoutes,
  ...smtpRoutes,
  ...templatesRoutes,
  ...uploadsRoutes,
  ...mappingRoutes,
  ...attachmentsRoutes,
  ...pdfTemplatesRoutes,
  ...campaignsRoutes,
  ...notificationsRoutes,
  ...adminUsersRoutes,
  ...adminSetupRoutes,
  ...broadcastRoutes,
  ...demoProjectRoutes,
  ...systemConfigRoutes,
];
