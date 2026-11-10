import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerActivity,
  tablerBook,
  tablerExternalLink,
  tablerFlag,
  tablerHistory,
  tablerLayoutSidebarLeftCollapse,
  tablerLayoutSidebarLeftExpand,
  tablerMenu2,
  tablerPlugConnected,
  tablerSettings,
  tablerSpeakerphone,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { filter } from 'rxjs';
import { SessionService } from '../core/session.service';
import { AccountMenu, ConfirmModal, Drawer, PageLayout } from '../ui';
import { Ripple } from '../ui/shared/ripple';
import { Pressed } from '../ui/shared/pressed';
import { environment } from '../../environments/environment';
import { ThemePreferencesService } from '../core/theme-preferences.service';
import { AdminSetupService } from '../features/setup/admin-setup.service';

type NavItem = { label: string; icon: string; link?: string; href?: string; external?: boolean };

const navLink = 'flex h-control-9 items-center gap-3 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

@Component({
  imports: [Ripple, Pressed, RouterLink, RouterLinkActive, RouterOutlet, AccountMenu, ConfirmModal, Drawer, PageLayout, NgIcon],
  providers: [provideIcons({ tablerActivity, tablerBook, tablerExternalLink, tablerFlag, tablerHistory, tablerLayoutSidebarLeftCollapse, tablerLayoutSidebarLeftExpand, tablerMenu2, tablerPlugConnected, tablerSettings, tablerSpeakerphone, tablerUsers })],
  selector: 'app-admin-layout',
  template: `
    <div class="min-h-dvh min-w-0 bg-background text-foreground md:grid transition-[grid-template-columns] duration-200 motion-reduce:transition-none" [style.grid-template-columns]="sidebarCollapsed() ? '4.5rem minmax(0,1fr)' : '15rem minmax(0,1fr)'">
      <header class="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-border bg-card px-3 py-2 md:hidden">
        <button appPressed type="button" class="sidebar-square-button grid size-11 shrink-0 place-items-center rounded-ui-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Open navigation" [attr.aria-expanded]="navigationOpen()" (click)="navigationOpen.set(true)"><ng-icon name="tablerMenu2" aria-hidden="true" class="size-5" /></button>
        <a routerLink="/flags" class="brand-link text-sm font-semibold">Slipakar</a>
        <span class="h-5 w-px bg-border" aria-hidden="true"></span>
        <span class="min-w-0 truncate text-sm font-medium" aria-live="polite">{{ mobileTitle() }}</span>
      </header>
      <aside class="sticky top-0 hidden h-dvh min-h-0 flex-col overflow-hidden border-r border-border bg-card px-3 py-4 md:flex" [class.px-5]="!sidebarCollapsed()">
        <div class="mb-6 flex min-h-10 items-center justify-between gap-2" [class.flex-col]="sidebarCollapsed()">
          <a routerLink="/flags" class="flex min-w-0 items-center gap-3 rounded-md text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Slipakar admin home" title="Slipakar">
            @if (!sidebarCollapsed()) { <span class="wordmark">Slipakar<span class="wordmark-dot">.</span></span> }
          </a>
          <button appPressed type="button" class="sidebar-square-button grid size-11 shrink-0 place-items-center rounded-ui-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" [attr.aria-label]="sidebarCollapsed() ? 'Expand sidebar' : 'Collapse sidebar'" [attr.title]="sidebarCollapsed() ? 'Expand sidebar' : 'Collapse sidebar'" [attr.aria-expanded]="!sidebarCollapsed()" (click)="toggleSidebar()">
            <ng-icon [name]="sidebarCollapsed() ? 'tablerLayoutSidebarLeftExpand' : 'tablerLayoutSidebarLeftCollapse'" aria-hidden="true" class="size-5" />
          </button>
        </div>
        <nav aria-label="Main navigation" class="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto" [class.justify-items-center]="sidebarCollapsed()">
          @for (item of items(); track item.label) {
            @if (item.link) {
              <a [routerLink]="item.link" routerLinkActive="bg-muted text-foreground" [attr.aria-label]="item.label" [attr.title]="item.label" [class]="linkClass" [class.px-3]="!sidebarCollapsed()" [class.w-control-9]="sidebarCollapsed()" [class.justify-center]="sidebarCollapsed()"><ng-icon [name]="item.icon" aria-hidden="true" class="size-5 shrink-0" />@if (!sidebarCollapsed()) { <span class="truncate">{{ item.label }}</span> }</a>
            } @else {
              <a [href]="item.href" [attr.target]="item.external ? '_blank' : null" [attr.rel]="item.external ? 'noopener noreferrer' : null" [attr.aria-label]="item.label" [attr.title]="item.label" [class]="linkClass" [class.px-3]="!sidebarCollapsed()" [class.w-control-9]="sidebarCollapsed()" [class.justify-center]="sidebarCollapsed()"><ng-icon [name]="item.icon" aria-hidden="true" class="size-5 shrink-0" />@if (!sidebarCollapsed()) { <span class="truncate">{{ item.label }}</span> }</a>
            }
          }
        </nav>
        <div class="mt-auto border-t border-border pt-3">
          <app-account-menu [collapsed]="sidebarCollapsed()" [email]="session.user()?.email ?? null" [name]="session.user()?.name ?? null" [imageUrl]="session.user()?.image ?? null" (signOutRequested)="signOutConfirming.set(true)" />
        </div>
      </aside>
      <main appPageLayout class="min-w-0 overflow-x-hidden"><router-outlet /></main>
    </div>
    <app-drawer [open]="navigationOpen()" [side]="'left'" title="Navigation" (closed)="navigationOpen.set(false)">
      <div class="flex min-h-full flex-col">
        <a routerLink="/flags" class="mb-6 flex h-control-9 items-center gap-3 rounded-md text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="navigationOpen.set(false)"><span class="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true">L</span>Slipakar</a>
        <nav aria-label="Main navigation" class="grid gap-1">
          @for (item of items(); track item.label) {
            @if (item.link) {
              <a [routerLink]="item.link" routerLinkActive="bg-muted text-foreground" [class]="linkClass + ' px-3'" (click)="navigationOpen.set(false)"><ng-icon [name]="item.icon" aria-hidden="true" class="size-5 shrink-0" />{{ item.label }}</a>
            } @else {
              <a [href]="item.href" [attr.target]="item.external ? '_blank' : null" [attr.rel]="item.external ? 'noopener noreferrer' : null" [class]="linkClass + ' px-3'" (click)="navigationOpen.set(false)"><ng-icon [name]="item.icon" aria-hidden="true" class="size-5 shrink-0" />{{ item.label }}</a>
            }
          }
        </nav>
        <div class="mt-auto border-t border-border pt-4"><app-account-menu [email]="session.user()?.email ?? null" [name]="session.user()?.name ?? null" [imageUrl]="session.user()?.image ?? null" (signOutRequested)="signOutConfirming.set(true)" /></div>
      </div>
    </app-drawer>
    <app-confirm-modal
      [open]="signOutConfirming()"
      title="Sign out?"
      message="You will need to sign in again to access the admin console."
      confirmLabel="Sign out"
      (cancelled)="signOutConfirming.set(false)"
      (confirmed)="confirmSignOut()"
    />
  `,
})
export class AdminLayout {
  protected readonly userAppUrl = environment.userAppUrl;
  protected readonly session = inject(SessionService);
  protected readonly setup = inject(AdminSetupService);
  protected readonly linkClass = navLink;
  private readonly themePreferences = inject(ThemePreferencesService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly signOutConfirming = signal(false);
  protected readonly navigationOpen = signal(false);
  protected readonly sidebarCollapsed = signal(this.readSidebarCollapsed());
  protected readonly mobileTitle = signal('Feature flags');

  protected readonly items = computed<NavItem[]>(() => [
    { label: 'Feature flags', icon: 'tablerFlag', link: '/flags' },
    { label: 'Monitoring', icon: 'tablerActivity', link: '/monitoring' },
    { label: 'Users', icon: 'tablerUsers', link: '/users' },
    { label: 'Preferences', icon: 'tablerSettings', link: '/preferences' },
    { label: 'Broadcasts', icon: 'tablerSpeakerphone', link: '/broadcasts' },
    { label: 'Login activity', icon: 'tablerHistory', link: '/login-activity' },
    ...(this.setup.view()?.complete ? [{ label: 'Integrations / Setup', icon: 'tablerPlugConnected', link: '/setup' }] : []),
    { label: 'API docs', icon: 'tablerBook', href: '/docs' },
    { label: 'Open user app', icon: 'tablerExternalLink', href: this.userAppUrl, external: true },
  ]);

  constructor() {
    this.themePreferences.initialize();
    this.updateMobileTitle();
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => {
      this.navigationOpen.set(false);
      this.updateMobileTitle();
    });
  }

  protected toggleSidebar(): void {
    const collapsed = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(collapsed);
    try { this.document.defaultView?.localStorage.setItem('slipakar.admin-sidebar-collapsed', String(collapsed)); } catch { /* Storage can be unavailable in private contexts. */ }
  }

  protected async confirmSignOut(): Promise<void> {
    this.signOutConfirming.set(false);
    await this.session.signOut();
    await this.router.navigate(['/login']);
  }

  private updateMobileTitle(): void {
    const route = this.router.url.split('?')[0]?.split('/').filter(Boolean).at(-1) ?? 'flags';
    const titles: Record<string, string> = { flags: 'Feature flags', monitoring: 'Monitoring', users: 'Users', preferences: 'Preferences', broadcasts: 'Broadcasts', 'login-activity': 'Login activity', setup: 'Integrations / Setup' };
    this.mobileTitle.set(titles[route] ?? 'Administration');
  }

  private readSidebarCollapsed(): boolean {
    try { return this.document.defaultView?.localStorage.getItem('slipakar.admin-sidebar-collapsed') === 'true'; }
    catch { return false; }
  }
}
