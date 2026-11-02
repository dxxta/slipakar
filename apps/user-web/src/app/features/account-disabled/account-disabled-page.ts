import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-account-disabled-page',
  imports: [RouterLink],
  template: `<main class="grid min-h-screen place-items-center bg-muted/40 px-5 py-12"><section class="w-full max-w-lg rounded-xl border border-border bg-card p-8 shadow-sm" aria-labelledby="account-disabled-title"><div class="mb-6 grid size-11 place-items-center rounded-full bg-destructive/10 text-destructive" aria-hidden="true"><svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4m0 4h.01M5.1 19h13.8c1.5 0 2.4-1.6 1.7-2.9L13.7 4.5c-.7-1.3-2.7-1.3-3.4 0L3.4 16.1c-.7 1.3.2 2.9 1.7 2.9Z" /></svg></div><h1 id="account-disabled-title" class="text-2xl font-semibold tracking-tight">Account disabled</h1><p class="mt-3 text-sm text-muted-foreground">This account has been disabled and cannot access the workspace. Contact your workspace administrator if you think this is a mistake.</p><a routerLink="/login" class="mt-6 inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Back to sign in</a></section></main>`,
})
export class AccountDisabledPage {}
