import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from '../../core/session.service';
import { ThemePreferencesService } from '../../core/theme-preferences.service';
import { ProfilePage } from './profile-page';
import type { ComponentFixture } from '@angular/core/testing';

describe('ProfilePage', () => {
  let http: HttpTestingController;
  let session: SessionService;
  const themePreferences = {
    preference: signal({ themeMode: 'system' as const, themeAccent: 'slate' as const }),
    setMode: vi.fn(),
    setAccent: vi.fn(),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ProfilePage], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: ThemePreferencesService, useValue: themePreferences }] });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
    session.user.set({ id: 'u-1', email: 'old@example.test', name: 'Ada Lovelace', role: 'user' });
  });

  afterEach(() => http.verify());

  function createFixture(): ComponentFixture<ProfilePage> {
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    http.expectOne('/api/auth/get-session').flush({ user: session.user(), session: {} });
    fixture.detectChanges();
    return fixture;
  }

  it('shows the initials avatar when the user has no custom image', () => {
    const fixture = createFixture();
    expect(fixture.nativeElement.querySelector('[data-testid="profile-avatar"] img')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="profile-avatar"]')?.textContent).toContain('AL');
  });


  it('updates the profile name through the Better Auth update-user endpoint', async () => {
    const fixture = createFixture();
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
    const fixture = createFixture();
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

  it('keeps the current email and shows a pending verification message', () => {
    const fixture = createFixture();
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

  it('shows when platform email verification is unavailable', () => {
    const fixture = createFixture();
    (fixture.nativeElement.querySelector('#profile-email') as HTMLInputElement).value = 'new@example.test';
    fixture.nativeElement.querySelector('#profile-email').dispatchEvent(new Event('input'));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-action="request-email-change"]').click();
    http.expectOne('/api/auth/change-email').flush({ code: 'EMAIL_CHANGE_UNAVAILABLE' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Email verification is unavailable');
  });

  it('offers theme mode and accent controls with a live preview', () => {
    const fixture = createFixture();
    const mode = fixture.nativeElement.querySelector('#theme-mode') as HTMLSelectElement;
    mode.value = 'dark';
    mode.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[aria-label="Blue accent"]') as HTMLButtonElement).click();
    expect(themePreferences.setMode).toHaveBeenCalledWith('dark');
    expect(themePreferences.setAccent).toHaveBeenCalledWith('blue');
    expect(fixture.nativeElement.querySelector('[data-theme-preview]')).not.toBeNull();
  });

  it('labels the default teal accent Slipakar and uses its brand swatch', () => {
    const fixture = createFixture();
    const button = fixture.nativeElement.querySelector('[aria-label="Slipakar accent"]') as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button?.querySelector('span')?.className).toContain('bg-[#126d63]');
  });
});
