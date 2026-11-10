import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SessionService } from '../core/session.service';
import { UnreadNotificationsStore } from '../core/unread-notifications.store';
import { ThemePreferencesService } from '../core/theme-preferences.service';
import { AccountMenu, ConfirmModal, Drawer, PageLayout } from '../ui';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet, AccountMenu, ConfirmModal, Drawer, PageLayout],
  selector: 'app-user-layout',
  template: `
    <div class="min-h-dvh min-w-0 bg-background text-foreground md:grid md:grid-cols-[15rem_1fr]">
      <header class="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-border bg-background px-3 py-2 md:hidden">
        <button type="button" class="grid size-11 shrink-0 place-items-center rounded-ui-md border border-border text-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Open navigation" [attr.aria-expanded]="navigationOpen()" (click)="navigationOpen.set(true)">☰</button>
        <a routerLink="/projects" class="text-sm font-semibold">Lokaslip</a>
        <span class="h-5 w-px bg-border" aria-hidden="true"></span>
        <span class="min-w-0 truncate text-sm font-medium" aria-live="polite">{{ mobileTitle() }}</span>
      </header>
      <aside class="hidden flex-col border-r border-border bg-card px-5 py-6 md:flex">
        <a routerLink="/projects" class="mb-10 flex items-center gap-3 rounded-md text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span class="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true">L</span><span>Lokaslip</span>
        </a>
        <nav aria-label="Main navigation" class="grid gap-1">
          <a routerLink="/projects" routerLinkActive="bg-muted text-foreground" class="flex min-h-10 items-center rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Projects</a>
          <a routerLink="/notifications" routerLinkActive="bg-muted text-foreground" class="flex min-h-10 items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span>Notifications</span>
            @if (unreadNotifications.count() > 0) {
              <span class="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground tabular-nums" aria-hidden="true">{{ unreadNotifications.count() > 99 ? '99+' : unreadNotifications.count() }}</span>
              <span class="sr-only">{{ unreadNotifications.count() }} unread</span>
            }
          </a>
          <a routerLink="/profile" routerLinkActive="bg-muted text-foreground" class="flex min-h-10 items-center rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Profile</a>
          <a routerLink="/login-activity" routerLinkActive="bg-muted text-foreground" class="flex min-h-10 items-center rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Login activity</a>
        </nav>
        <div class="mt-auto border-t border-border pt-4">
          <app-account-menu [email]="session.user()?.email ?? null" [name]="session.user()?.name ?? null" [imageUrl]="session.user()?.image ?? null" (signOutRequested)="signOutConfirming.set(true)" />
        </div>
      </aside>
      <main appPageLayout class="min-w-0 overflow-x-hidden"><router-outlet /></main>
    </div>
    <app-drawer [open]="navigationOpen()" [side]="'left'" title="Navigation" (closed)="navigationOpen.set(false)">
      <div class="flex min-h-full flex-col">
        <a routerLink="/projects" class="mb-6 flex min-h-11 items-center gap-3 rounded-md text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="navigationOpen.set(false)"><span class="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true">L</span>Lokaslip</a>
        <nav aria-label="Main navigation" class="grid gap-1">
          <a routerLink="/projects" routerLinkActive="bg-muted text-foreground" class="flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="navigationOpen.set(false)">Projects</a>
          <a routerLink="/notifications" routerLinkActive="bg-muted text-foreground" class="flex min-h-11 items-center justify-between rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="navigationOpen.set(false)"><span>Notifications</span>@if (unreadNotifications.count() > 0) { <span class="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground" aria-hidden="true">{{ unreadNotifications.count() > 99 ? '99+' : unreadNotifications.count() }}</span><span class="sr-only">{{ unreadNotifications.count() }} unread</span> }</a>
          <a routerLink="/profile" routerLinkActive="bg-muted text-foreground" class="flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="navigationOpen.set(false)">Profile</a>
          <a routerLink="/login-activity" routerLinkActive="bg-muted text-foreground" class="flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="navigationOpen.set(false)">Login activity</a>
        </nav>
        <div class="mt-auto border-t border-border pt-4"><app-account-menu [email]="session.user()?.email ?? null" [name]="session.user()?.name ?? null" [imageUrl]="session.user()?.image ?? null" (signOutRequested)="signOutConfirming.set(true)" /></div>
      </div>
    </app-drawer>
    <app-confirm-modal
      [open]="signOutConfirming()"
      title="Sign out?"
      message="You will need to sign in again to access your workspace."
      confirmLabel="Sign out"
      (cancelled)="signOutConfirming.set(false)"
      (confirmed)="confirmSignOut()"
    />
  `,
})
export class UserLayout implements OnInit {
  protected readonly session = inject(SessionService);
  protected readonly unreadNotifications = inject(UnreadNotificationsStore);
  private readonly themePreferences = inject(ThemePreferencesService);
  private readonly router = inject(Router);
  protected readonly signOutConfirming = signal(false);
  protected readonly navigationOpen = signal(false);
  protected readonly mobileTitle = signal('Projects');

  constructor() {
    this.updateMobileTitle();
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => {
      this.navigationOpen.set(false);
      this.updateMobileTitle();
    });
  }

  ngOnInit(): void {
    this.themePreferences.initialize();
    this.unreadNotifications.refresh();
  }

  protected async confirmSignOut(): Promise<void> {
    this.signOutConfirming.set(false);
    await this.session.signOut();
    await this.router.navigate(['/login']);
  }

  private updateMobileTitle(): void {
    const route = this.router.url.split('?')[0]?.split('/').filter(Boolean) ?? [];
    const titles: Record<string, string> = {
      projects: 'Projects', notifications: 'Notifications', profile: 'Profile', 'login-activity': 'Login activity', overview: 'Overview',
      smtp: 'SMTP', templates: 'Templates', data: 'Data', campaigns: 'Campaigns',
      'pdf-templates': 'PDF templates',
    };
    this.mobileTitle.set(titles[route.at(-1) ?? 'projects'] ?? 'Project');
  }
}
