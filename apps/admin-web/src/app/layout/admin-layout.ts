import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { SessionService } from '../core/session.service';
import { AccountMenu, ConfirmModal, Drawer, PageLayout } from '../ui';
import { environment } from '../../environments/environment';
import { ThemePreferencesService } from '../core/theme-preferences.service';
import { AdminSetupService } from '../features/setup/admin-setup.service';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet, AccountMenu, ConfirmModal, Drawer, PageLayout],
  selector: 'app-admin-layout',
  template: `
    <div class="min-h-screen min-w-0 bg-background text-foreground md:grid md:grid-cols-[15rem_1fr]">
      <header class="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-border bg-background px-3 py-2 md:hidden">
        <button type="button" class="grid size-11 shrink-0 place-items-center rounded-ui-md border border-border text-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Open navigation" [attr.aria-expanded]="navigationOpen()" (click)="navigationOpen.set(true)">☰</button>
        <a routerLink="/flags" class="text-sm font-semibold">Lokaslip</a>
        <span class="h-5 w-px bg-border" aria-hidden="true"></span>
        <span class="min-w-0 truncate text-sm font-medium" aria-live="polite">{{ mobileTitle() }}</span>
      </header>
      <aside class="hidden flex-col border-r border-border bg-card px-5 py-6 md:flex">
        <a routerLink="/flags" class="mb-10 flex items-center gap-3 rounded-md text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span class="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true">L</span>
          <span>Lokaslip</span>
        </a>
        <nav aria-label="Main navigation" class="grid gap-1">
          <a routerLink="/flags" routerLinkActive="bg-muted text-foreground" class="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Feature flags</a>
          <a routerLink="/monitoring" routerLinkActive="bg-muted text-foreground" class="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Monitoring</a>
          <a routerLink="/users" routerLinkActive="bg-muted text-foreground" class="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Users</a>
          <a routerLink="/preferences" routerLinkActive="bg-muted text-foreground" class="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Preferences</a>
          <a routerLink="/broadcasts" routerLinkActive="bg-muted text-foreground" class="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Broadcasts</a>
          <a routerLink="/login-activity" routerLinkActive="bg-muted text-foreground" class="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Login activity</a>
          @if (setup.view()?.complete) { <a routerLink="/setup" routerLinkActive="bg-muted text-foreground" class="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Integrations / Setup</a> }
          <a href="/docs" class="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">API docs</a>
          <a [href]="userAppUrl" target="_blank" rel="noopener noreferrer" class="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open user app</a>
        </nav>
        <div class="mt-auto border-t border-border pt-4">
          <app-account-menu [email]="session.user()?.email ?? null" [name]="session.user()?.name ?? null" [imageUrl]="session.user()?.image ?? null" (signOutRequested)="signOutConfirming.set(true)" />
        </div>
      </aside>
      <main appPageLayout class="min-w-0 overflow-x-hidden"><router-outlet /></main>
    </div>
    <app-drawer [open]="navigationOpen()" [side]="'left'" title="Navigation" (closed)="navigationOpen.set(false)">
      <div class="flex min-h-full flex-col">
        <a routerLink="/flags" class="mb-6 flex min-h-11 items-center gap-3 rounded-md text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="navigationOpen.set(false)"><span class="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true">L</span>Lokaslip</a>
        <nav aria-label="Main navigation" class="grid gap-1">
          <a routerLink="/flags" routerLinkActive="bg-muted text-foreground" class="flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="navigationOpen.set(false)">Feature flags</a>
          <a routerLink="/monitoring" routerLinkActive="bg-muted text-foreground" class="flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="navigationOpen.set(false)">Monitoring</a>
          <a routerLink="/users" routerLinkActive="bg-muted text-foreground" class="flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="navigationOpen.set(false)">Users</a>
          <a routerLink="/preferences" routerLinkActive="bg-muted text-foreground" class="flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="navigationOpen.set(false)">Preferences</a>
          <a routerLink="/broadcasts" routerLinkActive="bg-muted text-foreground" class="flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="navigationOpen.set(false)">Broadcasts</a>
          <a routerLink="/login-activity" routerLinkActive="bg-muted text-foreground" class="flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="navigationOpen.set(false)">Login activity</a>
          @if (setup.view()?.complete) { <a routerLink="/setup" routerLinkActive="bg-muted text-foreground" class="flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="navigationOpen.set(false)">Integrations / Setup</a> }
          <a href="/docs" class="flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="navigationOpen.set(false)">API docs</a>
          <a [href]="userAppUrl" target="_blank" rel="noopener noreferrer" class="flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="navigationOpen.set(false)">Open user app</a>
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
  private readonly themePreferences = inject(ThemePreferencesService);
  private readonly router = inject(Router);
  protected readonly signOutConfirming = signal(false);
  protected readonly navigationOpen = signal(false);
  protected readonly mobileTitle = signal('Feature flags');

  constructor() {
    this.themePreferences.initialize();
    this.updateMobileTitle();
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => {
      this.navigationOpen.set(false);
      this.updateMobileTitle();
    });
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
}
