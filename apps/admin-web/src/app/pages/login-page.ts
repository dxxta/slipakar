import { Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBrandGoogle } from '@ng-icons/tabler-icons';
import { HlmButton } from '../ui/button/src/lib/hlm-button';
import { SessionService } from '../core/session.service';
import { Pressed } from '../ui/shared/pressed';

@Component({
  imports: [Pressed, HlmButton, NgIcon],
  providers: [provideIcons({ tablerBrandGoogle })],
  selector: 'app-login-page',
  template: `
    <main class="grid min-h-dvh place-items-center bg-muted/40 px-5 py-12">
      <section appPressed class="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm" aria-labelledby="login-title">
        <div class="mb-8 flex items-center gap-3">
          <span class="grid size-10 place-items-center rounded-lg bg-primary font-semibold text-primary-foreground" aria-hidden="true">L</span>
          <span class="text-lg font-semibold">Slipakar</span>
        </div>
        <h1 id="login-title" class="text-2xl font-semibold tracking-tight">Sign in to your workspace</h1>
        <p class="mt-2 text-sm text-muted-foreground">Use your Google account to continue to the admin console.</p>
        <button hlmBtn class="mt-7 w-full" type="button" aria-label="Sign in with Google" (click)="session.signIn()">
          <ng-icon name="tablerBrandGoogle" class="mr-2 size-4" aria-hidden="true" />
          Continue with Google
        </button>
      </section>
    </main>
  `,
})
export class LoginPage {
  protected readonly session = inject(SessionService);
}
