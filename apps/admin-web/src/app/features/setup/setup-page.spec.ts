import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AdminSetupService, type AdminSetupView } from './admin-setup.service';
import { SetupPage } from './setup-page';

const incomplete: AdminSetupView = {
  complete: false,
  integrations: [
    { key: 'uptime', label: 'Uptime Kuma', configured: false, source: null, baseUrl: null, hasCredentials: false, credentialHint: null, settings: null, lastStatus: null, lastTestedAt: null, lastError: null },
    { key: 'grafana', label: 'Grafana', configured: true, source: 'database', baseUrl: 'https://grafana.example.test', hasCredentials: true, credentialHint: '••••1234', settings: null, lastStatus: 'failed', lastTestedAt: null, lastError: 'Connection refused' },
    { key: 'mail', label: 'Mail', configured: true, source: 'env', baseUrl: 'smtp.example.test', hasCredentials: true, credentialHint: '••••word', settings: { host: 'smtp.example.test', port: 587, secure: false, username: 'mailer', fromAddress: 'mailer@example.test' }, lastStatus: 'ok', lastTestedAt: null, lastError: null },
  ],
};

describe('SetupPage', () => {
  let fixture: ComponentFixture<SetupPage>;

  it('renders all three integration cards, status and source without exposing saved credentials', async () => {
    const load = vi.fn().mockResolvedValue(incomplete);
    await TestBed.configureTestingModule({
      imports: [SetupPage], providers: [provideRouter([]), { provide: AdminSetupService, useValue: { view: () => incomplete, load, save: vi.fn(), test: vi.fn(), clear: vi.fn() } }],
    }).compileComponents();
    fixture = TestBed.createComponent(SetupPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Uptime Kuma');
    expect(fixture.nativeElement.textContent).toContain('Grafana');
    expect(fixture.nativeElement.textContent).toContain('Mail');
    expect(fixture.nativeElement.textContent).toContain('Environment');
    expect(fixture.nativeElement.textContent).toContain('Failing');
    expect(fixture.nativeElement.textContent).not.toContain('saved-secret');
    expect(load).toHaveBeenCalledOnce();
  });

  it('opens mail settings and offers a test connection action', async () => {
    const test = vi.fn().mockReturnValue(of(incomplete.integrations[2]));
    await TestBed.configureTestingModule({
      imports: [SetupPage], providers: [provideRouter([]), { provide: AdminSetupService, useValue: { view: () => incomplete, load: vi.fn().mockResolvedValue(incomplete), save: vi.fn().mockResolvedValue(incomplete.integrations[2]), test, clear: vi.fn() } }],
    }).compileComponents();
    fixture = TestBed.createComponent(SetupPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const mailCard = [...fixture.nativeElement.querySelectorAll('article')].find((card: HTMLElement) => card.textContent?.includes('Mail')) as HTMLElement;
    (mailCard.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#mail-password')).not.toBeNull();
  });
});
