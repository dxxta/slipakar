import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle } from '@ng-icons/tabler-icons';
import { Ripple } from '../../ui/shared/ripple';
import { Pressed } from '../../ui/shared/pressed';

@Component({
  selector: 'app-account-disabled-page',
  imports: [Ripple, Pressed, RouterLink, NgIcon],
  providers: [provideIcons({ tablerAlertTriangle })],
  template: `<main class="grid min-h-dvh place-items-center bg-muted/40 px-5 py-12"><section appPressed class="w-full max-w-lg rounded-xl border border-border bg-card p-8 shadow-sm" aria-labelledby="account-disabled-title"><div class="mb-6 grid size-11 place-items-center rounded-full bg-destructive/10 text-destructive" aria-hidden="true"><ng-icon name="tablerAlertTriangle" class="size-5" /></div><h1 id="account-disabled-title" class="text-2xl font-semibold tracking-tight">Account disabled</h1><p class="mt-3 text-sm text-muted-foreground">This account has been disabled and cannot access the workspace. Contact your workspace administrator if you think this is a mistake.</p><a routerLink="/login" class="mt-6 inline-flex h-control-9 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Back to sign in</a></section></main>`,
})
export class AccountDisabledPage {}
