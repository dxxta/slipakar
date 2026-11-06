import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { SessionService } from '../core/session.service';
import { ThemePreferencesService } from '../core/theme-preferences.service';
import { AdminSetupService } from '../features/setup/admin-setup.service';
import { AdminLayout } from './admin-layout';

@Component({ template: '' })
class LoginTarget {}

describe('AdminLayout account controls', () => {
  it('requires confirmation before signing out', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [AdminLayout],
      providers: [
        provideRouter([{ path: 'login', component: LoginTarget }]),
        {
          provide: SessionService,
          useValue: { user: signal({ id: 'u1', email: 'admin@example.test', role: 'admin' }), signOut },
        },
        { provide: ThemePreferencesService, useValue: { initialize: vi.fn() } },
        { provide: AdminSetupService, useValue: { view: signal(null) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminLayout);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[aria-label="Account menu"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[role="menuitem"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(signOut).not.toHaveBeenCalled();

    (fixture.nativeElement.querySelector('[data-action="confirm"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(signOut).toHaveBeenCalledOnce();
    expect(TestBed.inject(Router).url).toBe('/login');
  });
});
