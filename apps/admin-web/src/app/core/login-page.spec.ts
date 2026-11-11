import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LoginPage } from '../pages/login-page';
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

  it('passes the guarded console route through the Google callback', async () => {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { queryParamMap: { get: (key: string) => key === 'returnUrl' ? '/flags?sortBy=name' : null } } },
    });
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button[aria-label="Sign in with Google"]') as HTMLButtonElement).click();
    const request = http.expectOne('/api/auth/sign-in/social');
    expect(request.request.body).toEqual({
      provider: 'google',
      callbackURL: `${window.location.origin}/flags?sortBy=name`,
    });
    request.flush({});
  });

  it('uses credential sign-in with the validated return path', async () => {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { queryParamMap: { get: (key: string) => key === 'returnUrl' ? '/users?sortBy=email' : null } } },
    });
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const email = fixture.nativeElement.querySelector('#credential-email') as HTMLInputElement;
    const password = fixture.nativeElement.querySelector('#credential-password') as HTMLInputElement;
    email.value = 'admin@example.com'; email.dispatchEvent(new Event('input'));
    password.value = 'a-long-enough-password'; password.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const request = http.expectOne('/api/auth/sign-in/email');
    expect(request.request.body).toEqual({ email: 'admin@example.com', password: 'a-long-enough-password', callbackURL: `${window.location.origin}/users?sortBy=email` });
    request.flush({ user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' }, token: 'session-token' });
    await fixture.whenStable();
    expect(TestBed.inject(SessionService).user()?.role).toBe('admin');
  });
});
