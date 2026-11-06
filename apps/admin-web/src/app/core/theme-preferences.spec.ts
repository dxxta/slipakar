import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { applyThemePreference, type ThemePreference } from './theme-preferences';
import { ThemePreferencesService } from './theme-preferences.service';

describe('theme preference application', () => {
  it('applies the selected accent and a forced dark mode to the document root', () => {
    const root = document.createElement('html');
    const preference: ThemePreference = { themeMode: 'dark', themeAccent: 'violet' };

    applyThemePreference(root, preference, true);

    expect(root.classList.contains('dark')).toBe(true);
    expect(root.dataset['themeMode']).toBe('dark');
    expect(root.dataset['accent']).toBe('violet');
  });

  it('uses the system preference when mode is system', () => {
    const root = document.createElement('html');

    applyThemePreference(root, { themeMode: 'system', themeAccent: 'slate' }, true);

    expect(root.classList.contains('dark')).toBe(true);
  });
});

describe('ThemePreferencesService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.removeItem('lokaslip.theme-preferences');
    TestBed.resetTestingModule();
  });

  it('applies a cached preference before loading the saved preference', () => {
    const cached: ThemePreference = { themeMode: 'dark', themeAccent: 'blue' };
    localStorage.setItem('lokaslip.theme-preferences', JSON.stringify(cached));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(ThemePreferencesService);
    const http = TestBed.inject(HttpTestingController);

    service.initialize();

    expect(service.preference()).toEqual(cached);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    http.expectOne('/me/preferences').flush({ message: 'ok', data: cached, success: true });
  });

  it('saves a changed preference to the API and local cache', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(ThemePreferencesService);
    const http = TestBed.inject(HttpTestingController);
    const changed: ThemePreference = { themeMode: 'light', themeAccent: 'rose' };

    service.setPreference(changed);

    expect(JSON.parse(localStorage.getItem('lokaslip.theme-preferences') ?? 'null')).toEqual(changed);
    const request = http.expectOne('/me/preferences');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(changed);
    request.flush({ message: 'ok', data: changed, success: true });
  });
});
