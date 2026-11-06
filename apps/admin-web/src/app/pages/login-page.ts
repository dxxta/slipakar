import { Component, inject } from '@angular/core';
import { HlmButton } from '../ui/button/src/lib/hlm-button';
import { SessionService } from '../core/session.service';

@Component({
  imports: [HlmButton],
  selector: 'app-login-page',
  template: `
    <main class="grid min-h-screen place-items-center bg-muted/40 px-5 py-12">
      <section class="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm" aria-labelledby="login-title">
        <div class="mb-8 flex items-center gap-3">
          <span class="grid size-10 place-items-center rounded-lg bg-primary font-semibold text-primary-foreground" aria-hidden="true">L</span>
          <span class="text-lg font-semibold">Lokaslip</span>
        </div>
        <h1 id="login-title" class="text-2xl font-semibold tracking-tight">Sign in to your workspace</h1>
        <p class="mt-2 text-sm text-muted-foreground">Use your Google account to continue to the admin console.</p>
        <button hlmBtn class="mt-7 w-full" type="button" aria-label="Sign in with Google" (click)="session.signIn()">
          <svg class="mr-2 size-4" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.24c1.9-1.75 2.98-4.33 2.98-7.37ZM12 22c2.7 0 4.97-.9 6.62-2.4l-3.24-2.52c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.58-4.13H3.07v2.6A10 10 0 0 0 12 22ZM6.42 13.91a6 6 0 0 1 0-3.82v-2.6H3.07a10 10 0 0 0 0 9.02l3.35-2.6ZM12 5.96c1.47 0 2.8.5 3.84 1.5l2.88-2.88A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.35 2.6C7.2 7.72 9.4 5.96 12 5.96Z"/></svg>
          Continue with Google
        </button>
      </section>
    </main>
  `,
})
export class LoginPage {
  protected readonly session = inject(SessionService);
}
