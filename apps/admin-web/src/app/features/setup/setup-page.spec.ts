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
      imports: [SetupPage], providers: [provideRouter([]), { provide: AdminSetupService, useValue: { view: () => incomplete, apiAccess: () => ({ environmentEnabled: true, allowedOrigins: ['https://app.example.test'], runtimeEnabled: false }), load, save: vi.fn(), test: vi.fn(), clear: vi.fn() } }],
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

  it('keeps environment-configured monitoring read-only while leaving mail editable and incomplete', async () => {
    const envView: AdminSetupView = {
      complete: false,
      integrations: [
        { key: 'uptime', label: 'Uptime Kuma', configured: true, source: 'env', baseUrl: 'http://uptime-kuma:3001', hasCredentials: true, credentialHint: null, settings: null, lastStatus: 'ok', lastTestedAt: null, lastError: null },
        { key: 'grafana', label: 'Grafana', configured: true, source: 'env', baseUrl: 'http://grafana:3000', hasCredentials: false, credentialHint: null, settings: null, lastStatus: 'ok', lastTestedAt: null, lastError: null },
        { key: 'mail', label: 'Mail', configured: false, source: null, baseUrl: null, hasCredentials: false, credentialHint: null, settings: null, lastStatus: null, lastTestedAt: null, lastError: null },
      ],
    };
    await TestBed.configureTestingModule({
      imports: [SetupPage], providers: [provideRouter([]), { provide: AdminSetupService, useValue: { view: () => envView, apiAccess: () => ({ environmentEnabled: false, allowedOrigins: [], runtimeEnabled: false }), load: vi.fn().mockResolvedValue(envView), save: vi.fn(), test: vi.fn(), clear: vi.fn() } }],
    }).compileComponents();
    fixture = TestBed.createComponent(SetupPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const grafana = fixture.nativeElement.querySelector('[data-testid="setup-row-grafana"]') as HTMLElement;
    const uptime = fixture.nativeElement.querySelector('[data-testid="setup-row-uptime"]') as HTMLElement;
    const mail = fixture.nativeElement.querySelector('[data-testid="setup-row-mail"]') as HTMLElement;
    expect(grafana.textContent).toContain('Configured by the Docker environment');
    expect(uptime.textContent).toContain('Configured by the Docker environment');
    expect(grafana.textContent).not.toContain('Edit settings');
    expect(uptime.textContent).not.toContain('Edit settings');
    expect(mail.textContent).toContain('Configure');
    expect(mail.textContent).toContain('Not configured');
    expect(envView.complete).toBe(false);
  });

  it('opens mail settings and offers a test connection action', async () => {
    const test = vi.fn().mockReturnValue(of(incomplete.integrations[2]));
    await TestBed.configureTestingModule({
      imports: [SetupPage], providers: [provideRouter([]), { provide: AdminSetupService, useValue: { view: () => incomplete, apiAccess: () => ({ environmentEnabled: true, allowedOrigins: [], runtimeEnabled: false }), load: vi.fn().mockResolvedValue(incomplete), save: vi.fn().mockResolvedValue(incomplete.integrations[2]), test, clear: vi.fn() } }],
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

  it('toggles how-to-configure disclosure on integration cards and shows compact help in the configure drawer', async () => {
    await TestBed.configureTestingModule({
      imports: [SetupPage],
      providers: [
        provideRouter([]),
        {
          provide: AdminSetupService,
          useValue: {
            view: () => incomplete,
            apiAccess: () => ({ environmentEnabled: true, allowedOrigins: [], runtimeEnabled: false }),
            load: vi.fn().mockResolvedValue(incomplete),
            save: vi.fn().mockResolvedValue(incomplete.integrations[0]),
            test: vi.fn(),
            clear: vi.fn(),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SetupPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const uptimeToggle = fixture.nativeElement.querySelector('[data-testid="help-toggle-uptime"]') as HTMLButtonElement;
    const grafanaToggle = fixture.nativeElement.querySelector('[data-testid="help-toggle-grafana"]') as HTMLButtonElement;
    const mailToggle = fixture.nativeElement.querySelector('[data-testid="help-toggle-mail"]') as HTMLButtonElement;
    const rowsContainer = fixture.nativeElement.querySelector('[data-testid="setup-integration-rows"]') as HTMLElement;

    expect(rowsContainer).not.toBeNull();
    expect(rowsContainer.classList.contains('grid-cols-1')).toBe(true);
    expect(rowsContainer.classList.contains('md:grid-cols-3')).toBe(false);
    expect(uptimeToggle).not.toBeNull();
    expect(grafanaToggle).not.toBeNull();
    expect(mailToggle).not.toBeNull();
    expect(uptimeToggle.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('[data-testid="card-help-uptime"]')).toBeNull();

    // Expand Uptime Kuma help
    uptimeToggle.click();
    fixture.detectChanges();
    expect(uptimeToggle.getAttribute('aria-expanded')).toBe('true');
    const uptimeHelp = fixture.nativeElement.querySelector('[data-testid="card-help-uptime"]') as HTMLElement;
    expect(uptimeHelp).not.toBeNull();
    expect(uptimeHelp.textContent).toContain('http://uptime-kuma:3001');
    expect(uptimeHelp.textContent).toContain('UPTIME_KUMA_ADMIN_PASSWORD');

    // Collapse Uptime Kuma help
    uptimeToggle.click();
    fixture.detectChanges();
    expect(uptimeToggle.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('[data-testid="card-help-uptime"]')).toBeNull();

    // Expand Grafana and Mail help on cards
    grafanaToggle.click();
    mailToggle.click();
    fixture.detectChanges();
    expect(grafanaToggle.getAttribute('aria-expanded')).toBe('true');
    expect(mailToggle.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('[data-testid="card-help-grafana"]')?.textContent).toContain('GRAFANA_ADMIN_PASSWORD');
    expect(fixture.nativeElement.querySelector('[data-testid="card-help-mail"]')?.textContent).toContain('AUTH_SMTP_*');

    // Open Uptime Kuma configure drawer and verify help is rendered above the form
    const uptimeCard = [...fixture.nativeElement.querySelectorAll('article')].find((card: HTMLElement) => card.textContent?.includes('Uptime Kuma')) as HTMLElement;
    (uptimeCard.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const drawerHelp = fixture.nativeElement.querySelector('[data-testid="drawer-help-uptime"]') as HTMLElement;
    expect(drawerHelp).not.toBeNull();
    expect(drawerHelp.textContent).toContain('How to configure');
    expect(drawerHelp.textContent).toContain('http://uptime-kuma:3001');
    expect(drawerHelp.nextElementSibling?.tagName).toBe('FORM');
  });
});
