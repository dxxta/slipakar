import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { SessionService } from '../core/session.service';
import { UnreadNotificationsStore } from '../core/unread-notifications.store';
import { ThemePreferencesService } from '../core/theme-preferences.service';
import { UserLayout } from './user-layout';

@Component({ template: '' })
class LoginTarget {}

describe('UserLayout account controls', () => {
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
