import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ThemePreferencesService } from '../../core/theme-preferences.service';
import { PreferencesPage } from './preferences-page';

describe('PreferencesPage', () => {
  it('updates the account theme and accent through the shared preferences service', async () => {
    const themePreferences = {
      preference: signal({ themeMode: 'system' as const, themeAccent: 'slate' as const }),
      setMode: vi.fn(),
      setAccent: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [PreferencesPage],
      providers: [{ provide: ThemePreferencesService, useValue: themePreferences }],
    }).compileComponents();
    const fixture = TestBed.createComponent(PreferencesPage);
    fixture.detectChanges();

    const mode = fixture.nativeElement.querySelector('#theme-mode') as HTMLSelectElement;
    mode.value = 'dark';
    mode.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[aria-label="Green accent"]') as HTMLButtonElement).click();

    expect(themePreferences.setMode).toHaveBeenCalledWith('dark');
    expect(themePreferences.setAccent).toHaveBeenCalledWith('green');
    expect(fixture.nativeElement.querySelector('[data-theme-preview]')).not.toBeNull();
  });
});
