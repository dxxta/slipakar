import { DOCUMENT } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBell, tablerFolder, tablerHistory, tablerLayoutSidebarLeftCollapse, tablerLayoutSidebarLeftExpand, tablerMenu2, tablerUser } from '@ng-icons/tabler-icons';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { SessionService } from '../core/session.service';
import { ThemePreferencesService } from '../core/theme-preferences.service';
import { UnreadNotificationsStore } from '../core/unread-notifications.store';
import { AccountMenu, ConfirmModal, Drawer, PageLayout } from '../ui';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet, AccountMenu, ConfirmModal, Drawer, PageLayout, NgIcon],
  providers: [provideIcons({ tablerBell, tablerFolder, tablerHistory, tablerLayoutSidebarLeftCollapse, tablerLayoutSidebarLeftExpand, tablerMenu2, tablerUser })],
  selector: 'app-user-layout',
  template: `
    <div class="min-h-dvh min-w-0 bg-background text-foreground md:grid transition-[grid-template-columns] duration-200 motion-reduce:transition-none" [style.grid-template-columns]="sidebarCollapsed() ? '4.5rem minmax(0,1fr)' : '15rem minmax(0,1fr)'">
      <header class="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-border bg-background px-3 py-2 md:hidden">
        <button type="button" class="grid size-9 shrink-0 place-items-center rounded-ui-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Open navigation" [attr.aria-expanded]="navigationOpen()" (click)="navigationOpen.set(true)"><ng-icon name="tablerMenu2" aria-hidden="true" class="size-5" /></button>
        <a routerLink="/projects" class="text-sm font-semibold">Slipakar</a>
        <span class="h-5 w-px bg-border" aria-hidden="true"></span>
        <span class="min-w-0 truncate text-sm font-medium" aria-live="polite">{{ mobileTitle() }}</span>
      </header>
      <aside class="sticky top-0 hidden h-dvh min-h-0 flex-col overflow-hidden border-r border-border bg-card px-3 py-4 md:flex" [class.px-5]="!sidebarCollapsed()">
        <div class="mb-6 flex min-h-10 items-center justify-between gap-2" [class.flex-col]="sidebarCollapsed()">
          <a routerLink="/projects" class="flex min-w-0 items-center gap-3 rounded-md text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Slipakar home" title="Slipakar">
            @if (!sidebarCollapsed()) { <a class="wordmark" href="/" aria-label="Slipakar home">Slipakar<span class="wordmark-dot">.</span></a> }
          </a>
          <button type="button" class="grid size-9 shrink-0 place-items-center rounded-ui-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" [attr.aria-label]="sidebarCollapsed() ? 'Expand sidebar' : 'Collapse sidebar'" [attr.title]="sidebarCollapsed() ? 'Expand sidebar' : 'Collapse sidebar'" [attr.aria-expanded]="!sidebarCollapsed()" (click)="toggleSidebar()">
            <ng-icon [name]="sidebarCollapsed() ? 'tablerLayoutSidebarLeftExpand' : 'tablerLayoutSidebarLeftCollapse'" aria-hidden="true" class="size-5" />
          </button>
        </div>
        <nav aria-label="Main navigation" class="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto" [class.justify-items-center]="sidebarCollapsed()">
          <a routerLink="/projects" routerLinkActive="bg-muted text-foreground" aria-label="Projects" title="Projects" [class.px-3]="!sidebarCollapsed()" [class.w-control-9]="sidebarCollapsed()" [class.justify-center]="sidebarCollapsed()" class="flex h-control-9 items-center gap-3 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ng-icon name="tablerFolder" aria-hidden="true" class="size-5 shrink-0" />@if (!sidebarCollapsed()) { <span>Projects</span> }</a>
          <a routerLink="/notifications" routerLinkActive="bg-muted text-foreground" [attr.aria-label]="unreadNotifications.count() > 0 ? 'Notifications, ' + unreadNotifications.count() + ' unread' : 'Notifications'" title="Notifications" [class.px-3]="!sidebarCollapsed()" [class.w-control-9]="sidebarCollapsed()" [class.justify-center]="sidebarCollapsed()" class="relative flex h-control-9 items-center gap-3 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ng-icon name="tablerBell" aria-hidden="true" class="size-5 shrink-0" />@if (!sidebarCollapsed()) { <span class="min-w-0 flex-1">Notifications</span> }@if (unreadNotifications.count() > 0) { <span [class.absolute]="sidebarCollapsed()" [class.right-1]="sidebarCollapsed()" [class.top-1]="sidebarCollapsed()" class="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground tabular-nums" aria-hidden="true">{{ unreadNotifications.count() > 99 ? '99+' : unreadNotifications.count() }}</span><span class="sr-only">{{ unreadNotifications.count() }} unread</span> }</a>
          <a routerLink="/profile" routerLinkActive="bg-muted text-foreground" aria-label="Profile" title="Profile" [class.px-3]="!sidebarCollapsed()" [class.w-control-9]="sidebarCollapsed()" [class.justify-center]="sidebarCollapsed()" class="flex h-control-9 items-center gap-3 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ng-icon name="tablerUser" aria-hidden="true" class="size-5 shrink-0" />@if (!sidebarCollapsed()) { <span>Profile</span> }</a>
          <a routerLink="/login-activity" routerLinkActive="bg-muted text-foreground" aria-label="Login activity" title="Login activity" [class.px-3]="!sidebarCollapsed()" [class.w-control-9]="sidebarCollapsed()" [class.justify-center]="sidebarCollapsed()" class="flex h-control-9 items-center gap-3 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ng-icon name="tablerHistory" aria-hidden="true" class="size-5 shrink-0" />@if (!sidebarCollapsed()) { <span>Login activity</span> }</a>
        </nav>
        <div class="mt-auto border-t border-border pt-3"><app-account-menu [collapsed]="sidebarCollapsed()" [email]="session.user()?.email ?? null" [name]="session.user()?.name ?? null" [imageUrl]="session.user()?.image ?? null" (signOutRequested)="signOutConfirming.set(true)" /></div>
      </aside>
      <main appPageLayout class="min-w-0 overflow-x-hidden"><router-outlet /></main>
    </div>
    <app-drawer [open]="navigationOpen()" [side]="'left'" title="Navigation" (closed)="navigationOpen.set(false)">
      <div class="flex min-h-full flex-col">
        <a routerLink="/projects" class="mb-6 flex h-control-9 items-center gap-3 rounded-md text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="navigationOpen.set(false)"><span class="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true">L</span>Slipakar</a>
        <nav aria-label="Main navigation" class="grid gap-1">
          <a routerLink="/projects" routerLinkActive="bg-muted text-foreground" class="flex h-control-9 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="navigationOpen.set(false)"><ng-icon name="tablerFolder" aria-hidden="true" class="size-5" />Projects</a>
          <a routerLink="/notifications" routerLinkActive="bg-muted text-foreground" class="flex h-control-9 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="navigationOpen.set(false)"><ng-icon name="tablerBell" aria-hidden="true" class="size-5" />Notifications@if (unreadNotifications.count() > 0) { <span class="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{{ unreadNotifications.count() > 99 ? '99+' : unreadNotifications.count() }}</span> }</a>
          <a routerLink="/profile" routerLinkActive="bg-muted text-foreground" class="flex h-control-9 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="navigationOpen.set(false)"><ng-icon name="tablerUser" aria-hidden="true" class="size-5" />Profile</a>
          <a routerLink="/login-activity" routerLinkActive="bg-muted text-foreground" class="flex h-control-9 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="navigationOpen.set(false)"><ng-icon name="tablerHistory" aria-hidden="true" class="size-5" />Login activity</a>
        </nav>
        <div class="mt-auto border-t border-border pt-4"><app-account-menu [email]="session.user()?.email ?? null" [name]="session.user()?.name ?? null" [imageUrl]="session.user()?.image ?? null" (signOutRequested)="signOutConfirming.set(true)" /></div>
      </div>
    </app-drawer>
    <app-confirm-modal [open]="signOutConfirming()" title="Sign out?" message="You will need to sign in again to access your workspace." confirmLabel="Sign out" (cancelled)="signOutConfirming.set(false)" (confirmed)="confirmSignOut()" />
  `,
})
export class UserLayout implements OnInit {
  protected readonly session = inject(SessionService);
  protected readonly unreadNotifications = inject(UnreadNotificationsStore);
  private readonly themePreferences = inject(ThemePreferencesService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly signOutConfirming = signal(false);
  protected readonly navigationOpen = signal(false);
  protected readonly sidebarCollapsed = signal(this.readSidebarCollapsed());
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

  protected toggleSidebar(): void {
    const collapsed = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(collapsed);
    try { this.document.defaultView?.localStorage.setItem('slipakar.sidebar-collapsed', String(collapsed)); } catch { /* Storage can be unavailable in private contexts. */ }
  }

  protected async confirmSignOut(): Promise<void> {
    this.signOutConfirming.set(false);
    await this.session.signOut();
    await this.router.navigate(['/login']);
  }

  private updateMobileTitle(): void {
    const route = this.router.url.split('?')[0]?.split('/').filter(Boolean) ?? [];
    const titles: Record<string, string> = { projects: 'Projects', notifications: 'Notifications', profile: 'Profile', 'login-activity': 'Login activity', overview: 'Overview', smtp: 'SMTP', templates: 'Templates', data: 'Data & Mapping', campaigns: 'Campaigns', 'pdf-templates': 'PDF templates' };
    this.mobileTitle.set(titles[route.at(-1) ?? 'projects'] ?? 'Project');
  }

  private readSidebarCollapsed(): boolean {
    try { return this.document.defaultView?.localStorage.getItem('slipakar.sidebar-collapsed') === 'true'; }
    catch { return false; }
  }
}
