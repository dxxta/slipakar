import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { UserLayout } from './layout/user-layout';
import { LoginPage } from './features/login/login-page';
import { NotFoundPage } from './features/not-found/not-found-page';
import { ProjectDetailLayout } from './features/project-detail/project-detail-layout';
import { AccountDisabledPage } from './features/account-disabled/account-disabled-page';
import { ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage } from './features/login/credential-pages';

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  { path: 'forgot-password', component: ForgotPasswordPage },
  { path: 'reset-password', component: ResetPasswordPage },
  { path: 'verify-email', component: VerifyEmailPage },
  { path: 'account-disabled', component: AccountDisabledPage },
  {
    path: '', component: UserLayout, canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'projects' },
      { path: 'projects', loadComponent: () => import('./features/projects/projects-page').then((page) => page.ProjectsPage) },
      { path: 'notifications', loadComponent: () => import('./features/notifications/notifications-page').then((page) => page.NotificationsPage) },
      { path: 'profile', loadComponent: () => import('./features/profile/profile-page').then((page) => page.ProfilePage) },
      { path: 'login-activity', loadComponent: () => import('./features/login-activity/login-activity-page').then((page) => page.LoginActivityPage) },
      {
        path: 'projects/:projectId', component: ProjectDetailLayout,
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'overview' },
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
        ],
      },
    ],
  },
  { path: '**', component: NotFoundPage },
];
