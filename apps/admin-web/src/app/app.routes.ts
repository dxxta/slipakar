import { Routes } from '@angular/router';
import { adminGuard } from './core/admin.guard';
import { AdminLayout } from './layout/admin-layout';
import { ForbiddenPage } from './pages/forbidden-page';
import { LoginPage } from './pages/login-page';
import { NotFoundPage } from './pages/not-found-page';
import { UserAppRedirect } from './pages/user-app-redirect';

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  { path: 'forbidden', component: ForbiddenPage },
  {
    path: '',
    component: AdminLayout,
    canActivateChild: [adminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'flags' },
      { path: 'flags', loadComponent: () => import('./features/flags/flags-page').then((page) => page.FlagsPage) },
      { path: 'monitoring', loadComponent: () => import('./features/monitoring/monitoring-page').then((page) => page.MonitoringPage) },
      { path: 'users', loadComponent: () => import('./features/users/users-page').then((page) => page.UsersPage) },
      { path: 'preferences', loadComponent: () => import('./features/preferences/preferences-page').then((page) => page.PreferencesPage) },
      { path: 'broadcasts', loadComponent: () => import('./features/broadcasts/broadcasts-page').then((page) => page.BroadcastsPage) },
      { path: 'login-activity', loadComponent: () => import('./features/login-activity/login-activity-page').then((page) => page.LoginActivityPage) },
      { path: 'setup', loadComponent: () => import('./features/setup/setup-page').then((page) => page.SetupPage) },
      { path: 'user-app', component: UserAppRedirect },
    ],
  },
  { path: '**', component: NotFoundPage },
];
