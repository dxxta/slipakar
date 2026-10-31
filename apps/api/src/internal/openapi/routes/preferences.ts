import type { RouteDoc } from '../../../domain/openapi/interface.js';
import { themePreferencesViewDto, updateThemePreferencesDto } from '../../../domain/preferences/dto.js';

export const preferencesRoutes: RouteDoc[] = [
  {
    method: 'get',
    path: '/me/preferences',
    summary: 'Get current user theme preferences',
    tag: 'Preferences',
    auth: 'session',
    status: 200,
    data: themePreferencesViewDto,
  },
  {
    method: 'patch',
    path: '/me/preferences',
    summary: 'Update current user theme preferences',
    tag: 'Preferences',
    auth: 'session',
    body: updateThemePreferencesDto,
    status: 200,
    data: themePreferencesViewDto,
  },
];
