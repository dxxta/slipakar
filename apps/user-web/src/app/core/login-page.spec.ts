import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LoginPage } from '../features/login/login-page';
import { SessionService } from './session.service';

describe('LoginPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LoginPage], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.inject(SessionService).clearReturnUrl();
  });

  it('starts Google sign-in when its accessible button is activated', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button[aria-label="Sign in with Google"]') as HTMLButtonElement;
    button.click();
    const request = http.expectOne('/api/auth/sign-in/social');
    expect(request.request.body).toEqual({ provider: 'google', callbackURL: `${window.location.origin}/` });
    request.flush({ url: 'https://accounts.google.test' });
  });

  it('passes the guard return URL through the Google callback', async () => {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { queryParamMap: { get: (key: string) => key === 'returnUrl' ? '/notifications?unread=true' : null } } },
    });
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button[aria-label="Sign in with Google"]') as HTMLButtonElement).click();
    const request = http.expectOne('/api/auth/sign-in/social');
    expect(request.request.body).toEqual({
      provider: 'google',
      callbackURL: `${window.location.origin}/notifications?unread=true`,
    });
    request.flush({});
  });

  it('submits credential sign-in and navigates only to a safe requested return URL', async () => {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { queryParamMap: { get: (key: string) => key === 'returnUrl' ? '/notifications?unread=true' : null } } },
    });
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const email = fixture.nativeElement.querySelector('#credential-email') as HTMLInputElement;
    const password = fixture.nativeElement.querySelector('#credential-password') as HTMLInputElement;
    email.value = 'person@example.com'; email.dispatchEvent(new Event('input'));
    password.value = 'a-long-enough-password'; password.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const request = http.expectOne('/api/auth/sign-in/email');
    expect(request.request.body).toEqual({ email: 'person@example.com', password: 'a-long-enough-password', callbackURL: `${window.location.origin}/notifications?unread=true` });
    request.flush({ user: { id: 'u1', email: 'person@example.com', role: 'user' }, token: 'session-token' });
    await fixture.whenStable();
    expect(TestBed.inject(SessionService).user()?.email).toBe('person@example.com');
  });

  it('shows an authenticator challenge and verifies it before completing sign-in', async () => {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { queryParamMap: { get: (key: string) => key === 'returnUrl' ? '/notifications' : null } } },
    });
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const email = fixture.nativeElement.querySelector('#credential-email') as HTMLInputElement;
    const password = fixture.nativeElement.querySelector('#credential-password') as HTMLInputElement;
    email.value = 'person@example.com'; email.dispatchEvent(new Event('input'));
    password.value = 'a-long-enough-password'; password.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    http.expectOne('/api/auth/sign-in/email').flush({ twoFactorRedirect: true, twoFactorMethods: ['totp'] });
    await fixture.whenStable(); fixture.detectChanges();
    const code = fixture.nativeElement.querySelector('#two-factor-code') as HTMLInputElement;
    expect(code.getAttribute('inputmode')).toBe('numeric');
    expect(code.getAttribute('autocomplete')).toBe('one-time-code');
    code.value = '123456'; code.dispatchEvent(new Event('input')); fixture.detectChanges();
    const verify = http.expectOne('/api/auth/two-factor/verify-totp');
    expect(verify.request.body).toEqual({ code: '123456', trustDevice: false });
    verify.flush({ token: 'session-token', user: { id: 'u1', email: 'person@example.com', role: 'user' } });
    await fixture.whenStable(); fixture.detectChanges();
    expect(TestBed.inject(SessionService).user()?.email).toBe('person@example.com');
  });

  it('shows the email verification confirmation after sign-up', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const createLink = [...fixture.nativeElement.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Create an account')) as HTMLButtonElement;
    createLink.click(); fixture.detectChanges();
    const setInput = (selector: string, value: string) => {
      const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
      input.value = value; input.dispatchEvent(new Event('input'));
    };
    setInput('#credential-name', 'Test Person'); setInput('#credential-email', 'person@example.com');
    setInput('#credential-password', 'a-long-enough-password'); setInput('#credential-confirm', 'a-long-enough-password');
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const request = http.expectOne('/api/auth/sign-up/email');
    expect(request.request.body).toEqual({ name: 'Test Person', email: 'person@example.com', password: 'a-long-enough-password', callbackURL: `${window.location.origin}/verify-email` });
    request.flush({ token: null });
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Check your email to verify your address');
  });
});
