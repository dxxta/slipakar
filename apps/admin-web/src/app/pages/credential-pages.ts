import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HlmButton } from '../ui/button/src/lib/hlm-button';
import { SessionService, credentialAuthErrorMessage } from '../core/session.service';

const authPageStyles = `.auth-control{width:100%;height:2.5rem;border:1px solid var(--input);border-radius:.5rem;background:var(--background);padding:0 .75rem;font-size:.875rem;outline:none}.auth-control:focus-visible{outline:2px solid var(--ring);outline-offset:2px}`;

@Component({
  selector: 'app-forgot-password-page', imports: [HlmButton, RouterLink], styles: [authPageStyles],
  template: `<main class="grid min-h-dvh place-items-center bg-muted/40 px-5 py-12"><section class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8"><h1 class="text-2xl font-semibold">Forgot password?</h1><p class="mt-2 text-sm text-muted-foreground">Enter your account email and we’ll send a recovery link if it exists.</p>@if (error()) {<p role="alert" class="mt-4 rounded-ui-md bg-[#E5484D]/10 p-3 text-sm text-[#E5484D]">{{error()}}</p>}@if (sent()) {<p role="status" class="mt-4 rounded-ui-md border border-primary/40 bg-primary/10 p-3 text-sm">If that email exists we sent a link.</p>}@else {<form class="mt-5 space-y-4" (submit)="submit($event)"><label class="grid gap-2 text-sm font-medium" for="forgot-email">Email<input id="forgot-email" class="auth-control" type="email" autocomplete="email" placeholder="name@example.com" [value]="email()" (input)="email.set(value($event))" required /></label><button hlmBtn class="w-full" [disabled]="busy()">{{ busy() ?'Sending…' : 'Send recovery link'}}</button></form>}<a routerLink="/login" class="mt-5 inline-flex text-sm underline underline-offset-4">Back to sign in</a></section></main>`,
})
export class ForgotPasswordPage {
  private readonly session = inject(SessionService);
  readonly email = signal(''); readonly busy = signal(false); readonly sent = signal(false); readonly error = signal<string | null>(null);
  protected value(event: Event): string { return (event.currentTarget as HTMLInputElement).value; }
  protected async submit(event: Event): Promise<void> {
    event.preventDefault(); if (this.busy()) return; this.busy.set(true); this.error.set(null);
    try { await this.session.requestPasswordReset(this.email()); this.sent.set(true); }
    catch (error: unknown) { this.error.set(credentialAuthErrorMessage(error)); }
    finally { this.busy.set(false); }
  }
}

@Component({
  selector: 'app-reset-password-page', imports: [HlmButton, RouterLink], styles: [authPageStyles],
  template: `<main class="grid min-h-dvh place-items-center bg-muted/40 px-5 py-12"><section class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8"><h1 class="text-2xl font-semibold">Choose a new password</h1><p class="mt-2 text-sm text-muted-foreground">Use at least 12 characters.</p>@if (error()) {<p role="alert" class="mt-4 rounded-ui-md bg-[#E5484D]/10 p-3 text-sm text-[#E5484D]">{{error()}}</p>}@if (done()) {<p role="status" class="mt-4 rounded-ui-md border border-primary/40 bg-primary/10 p-3 text-sm">Password updated. Sign in with your credential login.</p><a routerLink="/login" class="mt-4 inline-flex underline underline-offset-4">Sign in</a>}@else if (token) {<form class="mt-5 space-y-4" (submit)="submit($event)"><label class="grid gap-2 text-sm font-medium" for="reset-password">New password<input id="reset-password" class="auth-control" type="password" autocomplete="new-password" placeholder="At least 12 characters" [value]="password()" (input)="password.set(value($event))" minlength="12" required /></label><label class="grid gap-2 text-sm font-medium" for="reset-confirm">Confirm password<input id="reset-confirm" class="auth-control" type="password" autocomplete="new-password" placeholder="Re-enter your password" [value]="confirmation()" (input)="confirmation.set(value($event))" minlength="12" required /></label><button hlmBtn class="w-full" [disabled]="busy()">{{ busy() ?'Saving…' : 'Update password'}}</button></form>}@else {<p role="alert" class="mt-4 text-sm text-[#E5484D]">This password link is missing or invalid. Request a new link.</p><a routerLink="/forgot-password" class="mt-4 inline-flex underline underline-offset-4">Request a new link</a>}<a routerLink="/login" class="mt-5 inline-flex text-sm underline underline-offset-4">Back to sign in</a></section></main>`,
})
export class ResetPasswordPage {
  private readonly session = inject(SessionService); private readonly route = inject(ActivatedRoute);
  readonly token = this.route.snapshot.queryParamMap.get('token'); readonly password = signal(''); readonly confirmation = signal('');
  readonly busy = signal(false); readonly done = signal(false); readonly error = signal<string | null>(null);
  protected value(event: Event): string { return (event.currentTarget as HTMLInputElement).value; }
  protected async submit(event: Event): Promise<void> {
    event.preventDefault(); if (!this.token || this.busy()) return;
    if (this.password().length < 12) { this.error.set('Use a password with at least 12 characters.'); return; }
    if (this.password() !== this.confirmation()) { this.error.set('Passwords do not match.'); return; }
    this.busy.set(true); this.error.set(null);
    try { await this.session.resetPassword(this.token, this.password()); this.done.set(true); }
    catch (error: unknown) { this.error.set(credentialAuthErrorMessage(error)); }
    finally { this.busy.set(false); }
  }
}

@Component({
  selector: 'app-verify-email-page', imports: [RouterLink],
  template: `<main class="grid min-h-dvh place-items-center bg-muted/40 px-5 py-12"><section class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8"><h1 class="text-2xl font-semibold">Email verification</h1>@if(error){<p role="alert" class="mt-3 rounded-ui-md bg-[#E5484D]/10 p-3 text-sm text-[#E5484D]">{{error}}</p>}@else {<p role="status" class="mt-3 rounded-ui-md border border-primary/40 bg-primary/10 p-3 text-sm">Your email address is verified. You can now sign in.</p>}<a routerLink="/login" class="mt-5 inline-flex underline underline-offset-4">Continue to sign in</a></section></main>`,
})
export class VerifyEmailPage {
  private readonly route = inject(ActivatedRoute);
  readonly error = this.route.snapshot.queryParamMap.get('error') ? 'This verification link is invalid or expired. Request a new one.' : null;
}
