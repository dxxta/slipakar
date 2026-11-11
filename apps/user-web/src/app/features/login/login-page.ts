import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HlmButton } from '../../ui/button/src/lib/hlm-button';
import { SessionService, credentialAuthErrorMessage } from '../../core/session.service';
import { Ripple } from '../../ui/shared/ripple';

@Component({
  imports: [Ripple, HlmButton, RouterLink],
  selector: 'app-login-page',
  template: `
    <main class="grid min-h-dvh place-items-center bg-muted/40 px-5 py-12">
      <section class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8" aria-labelledby="login-title">
        <div class="mb-7 flex items-center gap-3"><span class="grid size-10 place-items-center rounded-full border-2 border-[var(--ink-fixed)] bg-primary font-semibold text-primary-foreground" aria-hidden="true">L</span><span class="text-lg font-semibold">Slipakar</span></div>
        @if (registered()) {
          <h1 id="login-title" class="text-2xl font-semibold tracking-tight">Check your email to verify your address</h1>
          <p role="status" class="mt-3 rounded-ui-md border border-primary/40 bg-primary/10 p-3 text-sm">We sent a verification link to {{ email() }}. Confirm your email before signing in.</p>
          <a routerLink="/login" class="mt-5 inline-flex underline underline-offset-4">Return to sign in</a>
        } @else {
          <h1 id="login-title" class="text-2xl font-semibold tracking-tight">{{ signingUp() ? 'Create your account' : 'Sign in to your workspace' }}</h1>
          <p class="mt-2 text-sm text-muted-foreground">Use Google login or your email and password.</p>
          @if (error()) { <p role="alert" class="mt-4 rounded-ui-md border border-[#E5484D]/30 bg-[#E5484D]/10 p-3 text-sm text-[#E5484D]">{{ error() }}</p> }
          <form class="mt-5 space-y-4" (submit)="submit($event)">
            @if (signingUp()) {
              <div class="grid gap-2"><label for="credential-name" class="text-sm font-medium">Name</label><input id="credential-name" name="name" autocomplete="name" class="credential-control" placeholder="Your name" [value]="name()" (input)="name.set(value($event))" required maxlength="100" /></div>
            }
            <div class="grid gap-2"><label for="credential-email" class="text-sm font-medium">Email</label><input id="credential-email" name="email" type="email" autocomplete="email" class="credential-control" placeholder="name@example.com" [value]="email()" (input)="email.set(value($event))" required /></div>
            <div class="grid gap-2"><label for="credential-password" class="text-sm font-medium">Password</label><div class="relative"><input id="credential-password" name="password" [type]="passwordVisible() ? 'text' : 'password'" [autocomplete]="signingUp() ? 'new-password' : 'current-password'" class="credential-control pr-20" placeholder="Enter your password" [value]="password()" (input)="password.set(value($event))" [attr.minlength]="signingUp() ? 12 : null" required /><button type="button" class="absolute inset-y-0 right-2 my-auto h-8 px-2 text-xs font-medium underline underline-offset-2" [attr.aria-label]="passwordVisible() ? 'Hide password' : 'Show password'" (click)="passwordVisible.update((visible) => !visible)">{{ passwordVisible() ? 'Hide' : 'Show' }}</button></div>@if (signingUp()) {<p class="text-xs text-muted-foreground">At least 12 characters</p>}</div>
            @if (signingUp()) { <div class="grid gap-2"><label for="credential-confirm" class="text-sm font-medium">Confirm password</label><input id="credential-confirm" name="confirmPassword" [type]="passwordVisible() ? 'text' : 'password'" autocomplete="new-password" class="credential-control" placeholder="Re-enter your password" [value]="confirmPassword()" (input)="confirmPassword.set(value($event))" minlength="12" required /></div> }
            <button hlmBtn class="w-full" type="submit" [disabled]="busy()">{{ busy() ? 'Please wait…' : signingUp() ? 'Create account' : 'Sign in' }}</button>
          </form>
          @if (!signingUp()) { <a routerLink="/forgot-password" class="mt-3 inline-flex text-sm underline underline-offset-4">Forgot password?</a> }
          <p class="mt-5 text-sm text-muted-foreground">{{ signingUp() ? 'Already have an account?' : 'New to Slipakar?' }} <button type="button" class="font-medium text-foreground underline underline-offset-4" (click)="toggleMode()">{{ signingUp() ? 'Sign in' : 'Create an account' }}</button></p>
          <div class="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span class="h-px flex-1 bg-border"></span><span>OR</span><span class="h-px flex-1 bg-border"></span></div>
          <button hlmBtn variant="outline" class="w-full" type="button" aria-label="Sign in with Google" (click)="signInWithGoogle()">Continue with Google</button>
        }
      </section>
    </main>
  `,
  styles: [`.credential-control{width:100%;height:2.5rem;border:1px solid var(--input);border-radius:.5rem;background:var(--background);padding:0 .75rem;font-size:.875rem;outline:none}.credential-control:focus-visible{outline:2px solid var(--ring);outline-offset:2px}`],
})
export class LoginPage {
  protected readonly session = inject(SessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly signingUp = signal(false);
  readonly registered = signal(false);
  readonly busy = signal(false);
  readonly passwordVisible = signal(false);
  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');
  readonly error = signal<string | null>(null);

  protected value(event: Event): string { return (event.currentTarget as HTMLInputElement).value; }

  protected toggleMode(): void {
    this.signingUp.update((value) => !value);
    this.error.set(null);
  }

  protected signInWithGoogle(): Promise<void> {
    return this.session.signIn(this.route.snapshot.queryParamMap.get('returnUrl') ?? undefined);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    const email = this.email().trim();
    const password = this.password();
    this.error.set(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { this.error.set('Enter a valid email address.'); return; }
    if (password.length < 12) { this.error.set('Use a password with at least 12 characters.'); return; }
    if (this.signingUp() && password !== this.confirmPassword()) { this.error.set('Passwords do not match.'); return; }
    this.busy.set(true);
    try {
      if (this.signingUp()) {
        if (!this.name().trim()) { this.error.set('Enter your name.'); this.busy.set(false); return; }
        await this.session.signUpWithEmail(this.name(), email, password, this.session.frontendPageUrl('verify-email'));
        this.registered.set(true);
        return;
      }
      const requested = this.route.snapshot.queryParamMap.get('returnUrl');
      const returnUrl = requested ? this.session.rememberReturnUrl(requested) : this.session.storedReturnUrl();
      await this.session.signInWithEmail(email, password, returnUrl ?? undefined);
      this.session.clearReturnUrl();
      await this.router.navigateByUrl(returnUrl ?? '/projects');
    } catch (error: unknown) {
      this.error.set(credentialAuthErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
