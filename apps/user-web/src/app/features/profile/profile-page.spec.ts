import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from '../../core/session.service';
import { ThemePreferencesService } from '../../core/theme-preferences.service';
import { ACCENT_PRESET_COLORS, defaultThemeColors, type ThemeAccent } from '../../core/theme-preferences';
import { ProfilePage } from './profile-page';
import type { ComponentFixture } from '@angular/core/testing';

vi.mock('qrcode', () => ({ toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr-code') }));

describe('ProfilePage', async () => {
  let http: HttpTestingController;
  let session: SessionService;
  const themeColors = signal(defaultThemeColors());
  const themePreferences = {
    preference: signal({ themeMode: 'system' as const, themeAccent: 'slate' as const }),
    themeColors,
    activeScheme: vi.fn(() => 'light' as const),
    appearanceStyle: signal('styled' as const),
    setMode: vi.fn(),
    setAppearanceStyle: vi.fn((style: 'styled' | 'unstyled') => themePreferences.appearanceStyle.set(style)),
    setAccent: vi.fn((accent: ThemeAccent) => themeColors.update((colors) => ({ ...colors, light: { ...colors.light, accent: ACCENT_PRESET_COLORS[accent] } }))),
    setBaseColor: vi.fn(),
    resetBaseColors: vi.fn(),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ProfilePage], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: ThemePreferencesService, useValue: themePreferences }] });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
    session.user.set({ id: 'u-1', email: 'old@example.test', name: 'Ada Lovelace', role: 'user' });
  });

  afterEach(() => http.verify());

  async function createFixture(accounts: { id: string; providerId: string; accountId: string }[] = [{ id: 'credential-1', providerId: 'credential', accountId: session.user()?.email ?? '' }]): Promise<ComponentFixture<ProfilePage>> {
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    http.expectOne('/api/auth/get-session').flush({ user: session.user(), session: {} });
    http.expectOne('/api/auth/list-accounts').flush(accounts);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows the initials avatar when the user has no custom image', async () => {
    const fixture = await createFixture();
    expect(fixture.nativeElement.querySelector('[data-testid="profile-avatar"] img')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="profile-avatar"]')?.textContent).toContain('AL');
  });



  it('keeps the page header and profile sections in one 24px spacing stack', async () => {
    const fixture = await createFixture();
    const header = fixture.nativeElement.querySelector('app-page-header') as HTMLElement;
    expect(header.parentElement?.classList.contains('space-y-6')).toBe(true);
  });

  it('shows credential sign-in methods and only shows email editing for credential accounts', async () => {
    const fixture = await createFixture();
    expect(fixture.nativeElement.textContent).toContain('Credential login');
    expect(fixture.nativeElement.textContent).toContain('Set');
    expect(fixture.nativeElement.querySelector('#email-heading')).not.toBeNull();
    fixture.destroy();

    const googleOnly = await createFixture([{ id: 'google-1', providerId: 'google', accountId: 'google-subject' }]);
    expect(googleOnly.nativeElement.querySelector('#email-heading')).toBeNull();
    expect(googleOnly.nativeElement.textContent).toContain('Your email follows your Google account.');
    expect(googleOnly.nativeElement.textContent).toContain('Connected');
    googleOnly.destroy();
  });

  it('keeps two-factor disabled until setup code verification, then shows backup codes once', async () => {
    const fixture = await createFixture();
    const enable = [...fixture.nativeElement.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Enable two-factor')) as HTMLButtonElement;
    enable.click(); fixture.detectChanges();
    const password = fixture.nativeElement.querySelector('#two-factor-password') as HTMLInputElement;
    password.value = 'a-long-enough-password'; password.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (password.closest('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const setup = http.expectOne('/api/auth/two-factor/enable');
    expect(setup.request.body).toEqual({ password: 'a-long-enough-password', method: 'totp', issuer: 'Slipakar' });
    setup.flush({ method: 'totp', totpURI: 'otpauth://totp/Slipakar:ada?secret=TESTSECRET&issuer=Slipakar', backupCodes: ['ABCDE-12345', 'FGHIJ-67890'] });
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#activate-two-factor-code')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('TESTSECRET');

    const code = fixture.nativeElement.querySelector('#activate-two-factor-code') as HTMLInputElement;
    code.value = '123456'; code.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (code.closest('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    http.expectOne('/api/auth/two-factor/verify-totp').flush({ token: 'session-token', user: { ...session.user(), twoFactorEnabled: true } });
    http.expectOne('/api/auth/get-session').flush({ user: { ...session.user(), twoFactorEnabled: true }, session: {} });
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Save these backup codes now');
    expect(fixture.nativeElement.querySelectorAll('ol li')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('#two-factor-heading')).not.toBeNull();
  });

  it('asks for password and current TOTP before disabling two-factor', async () => {
    session.user.set({ id: 'u-1', email: 'old@example.test', name: 'Ada Lovelace', role: 'user', twoFactorEnabled: true });
    const fixture = await createFixture();
    const disable = [...fixture.nativeElement.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Disable two-factor')) as HTMLButtonElement;
    disable.click(); fixture.detectChanges();
    const password = fixture.nativeElement.querySelector('#disable-two-factor-password') as HTMLInputElement;
    const code = fixture.nativeElement.querySelector('#disable-two-factor-code') as HTMLInputElement;
    password.value = 'a-long-enough-password'; password.dispatchEvent(new Event('input'));
    code.value = '123456'; code.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (password.closest('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const verify = http.expectOne('/api/auth/two-factor/verify-totp');
    expect(verify.request.body).toEqual({ code: '123456' });
    verify.flush({ token: 'session-token', user: session.user()! });
    const disableRequest = http.expectOne('/api/auth/two-factor/disable');
    expect(disableRequest.request.body).toEqual({ password: 'a-long-enough-password' });
    disableRequest.flush({ status: true });
    http.expectOne('/api/auth/get-session').flush({ user: { ...session.user(), twoFactorEnabled: false }, session: {} });
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Two-factor authentication disabled.');
  });

  it('requests a password setup link for a Google-only account and closes the drawer on success', async () => {
    const fixture = await createFixture([{ id: 'google-1', providerId: 'google', accountId: 'google-subject' }]);
    const setButton = [...fixture.nativeElement.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Set credential login')) as HTMLButtonElement;
    setButton.click(); fixture.detectChanges();
    const sendButton = [...fixture.nativeElement.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Send verification email')) as HTMLButtonElement;
    sendButton.click();
    const request = http.expectOne('/api/auth/request-password-reset');
    expect(request.request.body).toEqual({ email: 'old@example.test', redirectTo: `${window.location.origin}/reset-password` });
    request.flush({ status: true });
    await Promise.resolve();
    http.expectOne('/api/auth/list-accounts').flush([{ id: 'google-1', providerId: 'google', accountId: 'google-subject' }]);
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Check your email for a secure link');
  });

  it('updates the profile name through the Better Auth update-user endpoint', async () => {
    const fixture = await createFixture();
    const input = fixture.nativeElement.querySelector('#profile-name') as HTMLInputElement;
    input.value = 'Ada Byron';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-action="save-profile"]').click();

    const update = http.expectOne('/api/auth/update-user');
    expect(update.request.method).toBe('POST');
    expect(update.request.body).toEqual({ name: 'Ada Byron' });
    update.flush({ user: { ...session.user(), name: 'Ada Byron' } });
    http.expectOne('/api/auth/get-session').flush({ user: { ...session.user(), name: 'Ada Byron' }, session: {} });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(session.user()?.name).toBe('Ada Byron');
  });

  it('uploads and removes an avatar through the profile file endpoints', async () => {
    const fixture = await createFixture();
    await fixture.whenStable();
    fixture.detectChanges();
    const file = new File(['image-bytes'], 'avatar.png', { type: 'image/png' });
    const fileInput = fixture.nativeElement.querySelector('#avatar-file') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fileInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const upload = http.expectOne('/me/avatar');
    expect(upload.request.method).toBe('POST');
    expect(upload.request.body).toBeInstanceOf(FormData);
    expect((upload.request.body as FormData).get('file')).toEqual(file);
    upload.flush({ message: 'Avatar uploaded successfully', data: { url: '/me/avatar/u-1?v=mock-hash' }, success: true });
    http.expectOne('/api/auth/get-session').flush({ user: { ...session.user(), image: '/me/avatar/u-1?v=mock-hash' }, session: {} });
    await fixture.whenStable();
    await Promise.resolve();
    fixture.detectChanges();
    expect(session.user()?.image).toBe('/me/avatar/u-1?v=mock-hash');
    expect(fixture.componentInstance.image()).toBe('/me/avatar/u-1?v=mock-hash');
    expect((fixture.nativeElement.querySelector('[data-testid="profile-avatar"] img') as HTMLImageElement).getAttribute('src')).toContain('/me/avatar/u-1?v=mock-hash');

    fixture.nativeElement.querySelector('[data-action="remove-avatar"]').click();
    const remove = http.expectOne('/me/avatar');
    expect(remove.request.method).toBe('DELETE');
    remove.flush({ message: 'Avatar removed successfully', data: null, success: true });
    http.expectOne('/api/auth/get-session').flush({ user: { ...session.user(), image: null }, session: {} });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="profile-avatar"] img')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="profile-avatar"]')?.textContent).toContain('AL');
  });

  it('keeps the current email and shows a pending verification message', async () => {
    const fixture = await createFixture();
    (fixture.nativeElement.querySelector('#profile-email') as HTMLInputElement).value = 'new@example.test';
    fixture.nativeElement.querySelector('#profile-email').dispatchEvent(new Event('input'));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-action="request-email-change"]').click();
    const request = http.expectOne('/api/auth/change-email');
    expect(request.request.body).toEqual({ newEmail: 'new@example.test', callbackURL: '/profile' });
    request.flush({ status: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Check new@example.test to confirm');
    expect(session.user()?.email).toBe('old@example.test');
  });

  it('shows when platform email verification is unavailable', async () => {
    const fixture = await createFixture();
    (fixture.nativeElement.querySelector('#profile-email') as HTMLInputElement).value = 'new@example.test';
    fixture.nativeElement.querySelector('#profile-email').dispatchEvent(new Event('input'));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-action="request-email-change"]').click();
    http.expectOne('/api/auth/change-email').flush({ code: 'EMAIL_CHANGE_UNAVAILABLE' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Email verification is unavailable');
  });

  it('offers theme mode and accent controls with a live preview', async () => {
    const fixture = await createFixture();
    const mode = fixture.nativeElement.querySelector('#theme-mode') as HTMLSelectElement;
    mode.value = 'dark';
    mode.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[aria-label="Blue accent"]') as HTMLButtonElement).click();
    expect(themePreferences.setMode).toHaveBeenCalledWith('dark');
    expect(themePreferences.setAccent).toHaveBeenCalledWith('blue');
    expect(fixture.nativeElement.querySelector('[data-theme-preview]')).not.toBeNull();
  });

  it('labels the default lime accent and uses its brand swatch', async () => {
    const fixture = await createFixture();
    const button = fixture.nativeElement.querySelector('[aria-label="Lime accent"]') as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button?.querySelector('span')?.getAttribute('style')).toContain('background-color');
  });
});
