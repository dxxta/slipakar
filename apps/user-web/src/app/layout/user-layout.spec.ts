import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from '../core/session.service';
import { UnreadNotificationsStore } from '../core/unread-notifications.store';
import { ThemePreferencesService } from '../core/theme-preferences.service';
import { UserLayout } from './user-layout';

@Component({ template: '' })
class LoginTarget {}

describe('UserLayout account controls', () => {
  beforeEach(() => localStorage.removeItem('slipakar.sidebar-collapsed'));
  it('collapses the desktop sidebar, exposes icon labels, and persists the choice', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [UserLayout],
      providers: [
        provideRouter([{ path: 'login', component: LoginTarget }]),
        { provide: SessionService, useValue: { user: signal({ id: 'u1', email: 'person@example.test', role: 'user' }), signOut } },
        { provide: UnreadNotificationsStore, useValue: { count: signal(3), refresh: vi.fn() } },
        { provide: ThemePreferencesService, useValue: { initialize: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(UserLayout);
    fixture.detectChanges();
    const toggle = fixture.nativeElement.querySelector('[aria-label="Collapse sidebar"]') as HTMLButtonElement;
    expect(toggle).not.toBeNull();
    toggle.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="Expand sidebar"]')).not.toBeNull();
    const desktopNav = fixture.nativeElement.querySelector('aside nav') as HTMLElement;
    expect(desktopNav.querySelector('a[aria-label="Projects"]')).not.toBeNull();
    expect(desktopNav.querySelector('a[aria-label="Notifications, 3 unread"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('aside').className).toContain('h-dvh');
    expect(localStorage.getItem('slipakar.sidebar-collapsed')).toBe('true');
  });

  it('requires confirmation before signing out', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [UserLayout],
      providers: [
        provideRouter([{ path: 'login', component: LoginTarget }]),
        {
          provide: SessionService,
          useValue: { user: signal({ id: 'u1', email: 'person@example.test', role: 'user' }), signOut },
        },
        { provide: UnreadNotificationsStore, useValue: { count: signal(0), refresh: vi.fn() } },
        { provide: ThemePreferencesService, useValue: { initialize: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(UserLayout);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[aria-label="Account menu"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (Array.from(fixture.nativeElement.querySelectorAll('[role="menuitem"]')) as HTMLButtonElement[]).find((item) => item.textContent?.includes('Sign out'))?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(signOut).not.toHaveBeenCalled();

    (fixture.nativeElement.querySelector('[data-action="confirm"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(signOut).toHaveBeenCalledOnce();
    expect(TestBed.inject(Router).url).toBe('/login');
  });
});
