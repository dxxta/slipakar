import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LoginPage } from '../features/login/login-page';

describe('LoginPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LoginPage], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts Google sign-in when its accessible button is activated', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button[aria-label="Sign in with Google"]') as HTMLButtonElement;
    button.click();
    const request = http.expectOne('/api/auth/sign-in/social');
    expect(request.request.body).toEqual({ provider: 'google', callbackURL: `${window.location.origin}/` });
    request.flush({ url: 'https://accounts.google.test' });
  });
});
