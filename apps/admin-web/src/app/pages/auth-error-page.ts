import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HlmButton } from '../ui/button/src/lib/hlm-button';

const authErrorMessages: Record<string, string> = {
  account_disabled: 'This account is disabled. Contact your administrator.',
  google_email_not_verified: 'Google must provide a verified email address.',
  email_not_verified: 'Verify your account email before linking Google login.',
  google_email_already_in_use: 'That Google email is already connected to another account.',
  google_account_invalid: 'Google account details are incomplete. Try again.',
  credential_login_required: 'Set a credential login before disconnecting Google.',
  access_denied: 'Google sign-in was cancelled.',
  account_not_linked: 'This Google account is not linked to a Slipakar account yet. Sign in with your email and password first, then connect Google from Profile.',
  state_mismatch: 'The sign-in session expired. Please try again.',
  please_restart_the_process: 'The sign-in session expired. Please try again.',
  unable_to_create_user: 'We could not create your account. Try again later.',
};

@Component({
  selector: 'app-auth-error-page',
  imports: [HlmButton, RouterLink],
  template: `
    <main class="grid min-h-dvh place-items-center bg-muted/40 px-5 py-12">
      <section class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8" aria-labelledby="auth-error-title">
        <div class="mb-7"><span class="wordmark">Slipakar<span class="wordmark-dot">.</span></span></div>
        <h1 id="auth-error-title" class="text-2xl font-semibold tracking-tight">Sign-in problem</h1>
        <div role="alert" class="mt-4 rounded-ui-md border border-[#E5484D]/30 bg-[#E5484D]/10 p-3 text-sm text-[#E5484D]">
          <p>{{ message }}</p>
        </div>
        @if (displayCode) { <p class="mt-3 font-mono text-xs text-muted-foreground">Code: {{ displayCode }}</p> }
        <a hlmBtn class="mt-6 w-full" routerLink="/login">Back to sign in</a>
      </section>
    </main>
  `,
})
export class AuthErrorPage {
  private readonly route = inject(ActivatedRoute);
  private readonly rawError = this.route.snapshot.queryParamMap.get('error')?.trim() ?? '';
  private readonly normalizedError = this.rawError.toLowerCase().replace(/[\s-]+/g, '_');
  readonly displayCode = /^[A-Za-z0-9_ -]{1,60}$/.test(this.rawError) ? this.rawError : null;
  readonly message = authErrorMessages[this.normalizedError]
    ?? this.route.snapshot.queryParamMap.get('error_description')
    ?? 'Something went wrong while signing in. Try again.';
}
