import { Component, inject } from '@angular/core';
import { HlmButton } from '../../ui/button/src/lib/hlm-button';
import { SessionService } from '../../core/session.service';

@Component({
  imports: [HlmButton], selector: 'app-login-page',
  template: `<main class="grid min-h-screen place-items-center bg-muted/40 px-5 py-12"><section class="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm" aria-labelledby="login-title"><div class="mb-8 flex items-center gap-3"><span class="grid size-10 place-items-center rounded-lg bg-primary font-semibold text-primary-foreground" aria-hidden="true">L</span><span class="text-lg font-semibold">Lokaslip</span></div><h1 id="login-title" class="text-2xl font-semibold tracking-tight">Sign in to your workspace</h1><p class="mt-2 text-sm text-muted-foreground">Use your Google account to manage your projects.</p><button hlmBtn class="mt-7 w-full" type="button" aria-label="Sign in with Google" (click)="session.signIn()">Continue with Google</button></section></main>`,
})
export class LoginPage {
  protected readonly session = inject(SessionService);
}
