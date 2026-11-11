import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { embedEntryGuard, embedScopeGuard, keepUnknownRouteInEmbedGuard, preventAuthRouteInEmbedGuard } from './core/embed.guard';
import { UserLayout } from './layout/user-layout';
import { EmbedLayout } from './layout/embed-layout';
import { EmbedProjectLayout } from './layout/embed-project-layout';
import { LoginPage } from './features/login/login-page';
import { NotFoundPage } from './features/not-found/not-found-page';
import { ProjectDetailLayout } from './features/project-detail/project-detail-layout';
import { AccountDisabledPage } from './features/account-disabled/account-disabled-page';
import { ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage } from './features/login/credential-pages';

const projectFeatureRoutes: Routes = [
  { path: 'overview', loadComponent: () => import('./features/project-detail/tabs/overview-page').then((page) => page.ProjectOverviewPage) },
  { path: 'api-keys', loadComponent: () => import('./features/api-keys/api-keys-page').then((page) => page.ApiKeysPage) },
  { path: 'smtp', loadComponent: () => import('./features/smtp/smtp-page').then((page) => page.SmtpPage) },
  { path: 'templates/new', loadComponent: () => import('./features/templates/template-edit-page').then((page) => page.TemplateEditPage) },
  { path: 'templates/:templateId', loadComponent: () => import('./features/templates/template-edit-page').then((page) => page.TemplateEditPage) },
  { path: 'templates', loadComponent: () => import('./features/templates/templates-page').then((page) => page.TemplatesPage) },
  { path: 'data', loadComponent: () => import('./features/data/data-page').then((page) => page.DataPage) },
  { path: 'campaigns', loadComponent: () => import('./features/campaigns/campaigns-list-page').then((page) => page.CampaignsListPage) },
  { path: 'campaigns/new', loadComponent: () => import('./features/campaigns/campaign-create-page').then((page) => page.CampaignCreatePage) },
  { path: 'campaigns/:campaignId', loadComponent: () => import('./features/campaigns/campaign-detail-page').then((page) => page.CampaignDetailPage) },
  { path: 'pdf-templates', loadComponent: () => import('./features/pdf-templates/pdf-templates-list-page').then((page) => page.PdfTemplatesListPage) },
  { path: 'pdf-templates/new', loadComponent: () => import('./features/pdf-templates/pdf-template-edit-page').then((page) => page.PdfTemplateEditPage) },
  { path: 'pdf-templates/:templateId', loadComponent: () => import('./features/pdf-templates/pdf-template-edit-page').then((page) => page.PdfTemplateEditPage) },
];

const embedRouteScopes: Record<string, string[]> = {
  templates: ['templates:read'],
  'templates/new': ['templates:write'],
  'templates/:templateId': ['templates:read', 'templates:write'],
  data: ['uploads:read', 'mappings:read'],
  campaigns: ['campaigns:read'],
  'campaigns/new': ['campaigns:read', 'campaigns:write', 'uploads:read', 'mappings:read', 'templates:read', 'smtp:read'],
  'campaigns/:campaignId': ['campaigns:read', 'recipients:read'],
  'pdf-templates': ['templates:read'],
  'pdf-templates/new': ['templates:read', 'templates:write', 'uploads:read', 'uploads:write'],
  'pdf-templates/:templateId': ['templates:read', 'templates:write', 'uploads:read', 'uploads:write'],
};
const embedFeatureRoutes: Routes = projectFeatureRoutes
  .filter((route) => route.path && route.path !== 'overview' && route.path !== 'api-keys' && route.path !== 'smtp')
  .map((route) => ({
    ...route,
    canActivate: [embedScopeGuard],
    data: { embedScopes: embedRouteScopes[route.path ?? ''] ?? [] },
  }));

export const routes: Routes = [
  { path: 'login', component: LoginPage, canActivate: [preventAuthRouteInEmbedGuard] },
  { path: 'forgot-password', component: ForgotPasswordPage, canActivate: [preventAuthRouteInEmbedGuard] },
  { path: 'reset-password', component: ResetPasswordPage, canActivate: [preventAuthRouteInEmbedGuard] },
  { path: 'verify-email', component: VerifyEmailPage, canActivate: [preventAuthRouteInEmbedGuard] },
  { path: 'account-disabled', component: AccountDisabledPage, canActivate: [preventAuthRouteInEmbedGuard] },
  {
    path: 'embed', component: EmbedLayout, canActivate: [embedEntryGuard],
    children: [{ path: 'projects/:projectId', component: EmbedProjectLayout, children: embedFeatureRoutes }],
  },
  {
    path: '', component: UserLayout, canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'projects' },
      { path: 'projects', loadComponent: () => import('./features/projects/projects-page').then((page) => page.ProjectsPage) },
      { path: 'notifications', loadComponent: () => import('./features/notifications/notifications-page').then((page) => page.NotificationsPage) },
      { path: 'profile', loadComponent: () => import('./features/profile/profile-page').then((page) => page.ProfilePage) },
      { path: 'login-activity', loadComponent: () => import('./features/login-activity/login-activity-page').then((page) => page.LoginActivityPage) },
      { path: 'projects/:projectId', component: ProjectDetailLayout, children: [{ path: '', pathMatch: 'full', redirectTo: 'overview' }, ...projectFeatureRoutes] },
    ],
  },
  { path: '**', component: NotFoundPage, canActivate: [keepUnknownRouteInEmbedGuard] },
];
