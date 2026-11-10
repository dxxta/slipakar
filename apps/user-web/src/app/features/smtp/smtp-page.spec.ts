import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SmtpPage } from './smtp-page';
import type { SmtpConnection } from './smtp.service';

const mockSmtp: SmtpConnection = {
  id: 'smtp-1',
  projectId: 'p-1',
  host: 'smtp.mailtrap.io',
  port: 587,
  username: 'user-test',
  secure: false,
  fromAddress: 'sender@example.com',
};

describe('SmtpPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [SmtpPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: (key: string) => (key === 'projectId' ? 'p-1' : null) } },
            parent: null,
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('shows loading skeleton while connections are loading', () => {
    const fixture = TestBed.createComponent(SmtpPage);
    fixture.detectChanges();

    const skeleton = fixture.nativeElement.querySelector('[data-list-state="loading"]');
    expect(skeleton).not.toBeNull();

    const req = http.expectOne('/projects/p-1/smtp?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    expect(req.request.method).toBe('GET');
    req.flush({ message: 'ok', data: [mockSmtp], metadata: { page: 1, limit: 20, total: 1 }, success: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-list-state="loading"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('smtp.mailtrap.io:587');
    expect(fixture.nativeElement.querySelector('table[aria-label="SMTP connections list"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="smtp-row-smtp-1"]')).not.toBeNull();
  });

  it('shows empty state when no connections exist', () => {
    const fixture = TestBed.createComponent(SmtpPage);
    fixture.detectChanges();

    const req = http.expectOne('/projects/p-1/smtp?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    req.flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-list-state="empty"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No SMTP connections yet');
  });

  it('shows error state when GET fails and retries on Retry click', () => {
    const fixture = TestBed.createComponent(SmtpPage);
    fixture.detectChanges();

    const req = http.expectOne('/projects/p-1/smtp?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    req.flush({ error: { code: 'INTERNAL', message: 'Failed to connect' } }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const errorState = fixture.nativeElement.querySelector('[data-list-state="error"]');
    expect(errorState).not.toBeNull();
    expect(errorState.textContent).toContain('Failed to connect');

    const retryBtn = errorState.querySelector('button') as HTMLButtonElement;
    retryBtn.click();
    fixture.detectChanges();

    const retryReq = http.expectOne('/projects/p-1/smtp?page=1&limit=20&sortBy=createdAt&sortDir=desc');
    retryReq.flush({ message: 'ok', data: [mockSmtp], metadata: { page: 1, limit: 20, total: 1 }, success: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-list-state="error"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('smtp.mailtrap.io:587');
  });

  it('creates an SMTP connection with write-only password and required fromAddress', () => {
    const fixture = TestBed.createComponent(SmtpPage);
    fixture.detectChanges();

    http.expectOne('/projects/p-1/smtp?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();

    // Open add form
    fixture.nativeElement.querySelector('[data-testid="empty-add-smtp-button"]').click();
    fixture.detectChanges();

    const hostInput = fixture.nativeElement.querySelector('[data-testid="smtp-host-input"]') as HTMLInputElement;
    const portInput = fixture.nativeElement.querySelector('[data-testid="smtp-port-input"]') as HTMLInputElement;
    const userInput = fixture.nativeElement.querySelector('[data-testid="smtp-username-input"]') as HTMLInputElement;
    const passInput = fixture.nativeElement.querySelector('[data-testid="smtp-password-input"]') as HTMLInputElement;
    const fromInput = fixture.nativeElement.querySelector('[data-testid="smtp-from-address-input"]') as HTMLInputElement;

    hostInput.value = 'smtp.sendgrid.net';
    hostInput.dispatchEvent(new Event('input'));
    portInput.value = '465';
    portInput.dispatchEvent(new Event('input'));
    userInput.value = 'apikey@sendgrid.com';
    userInput.dispatchEvent(new Event('input'));
    // Prefill should have set fromInput to username since it looks like an email
    fixture.detectChanges();
    expect(fromInput.value).toBe('apikey@sendgrid.com');

    passInput.value = 'SG.12345';
    passInput.dispatchEvent(new Event('input'));
    fromInput.value = 'notifications@example.com';
    fromInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="smtp-save-button"]').click();
    fixture.detectChanges();

    const createReq = http.expectOne('/projects/p-1/smtp');
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual({
      host: 'smtp.sendgrid.net',
      port: 465,
      username: 'apikey@sendgrid.com',
      password: 'SG.12345',
      secure: false,
      fromAddress: 'notifications@example.com',
    });

    createReq.flush({
      message: 'SMTP created',
      data: {
        id: 'smtp-2',
        projectId: 'p-1',
        host: 'smtp.sendgrid.net',
        port: 465,
        username: 'apikey@sendgrid.com',
        secure: false,
        fromAddress: 'notifications@example.com',
      },
      success: true,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('smtp.sendgrid.net:465');
  });

  it('edits an SMTP connection without requiring password and sends only changed fields', () => {
    const fixture = TestBed.createComponent(SmtpPage);
    fixture.detectChanges();

    http.expectOne('/projects/p-1/smtp?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [mockSmtp], metadata: { page: 1, limit: 20, total: 1 }, success: true });
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="smtp-actions-smtp-1"] button[aria-haspopup="menu"]').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[role="menuitem"]:nth-child(2)').click();
    fixture.detectChanges();

    const hostInput = fixture.nativeElement.querySelector('[data-testid="smtp-host-input"]') as HTMLInputElement;
    const passInput = fixture.nativeElement.querySelector('[data-testid="smtp-password-input"]') as HTMLInputElement;

    expect(hostInput.value).toBe('smtp.mailtrap.io');
    expect(passInput.value).toBe(''); // Never populated

    hostInput.value = 'smtp.updated.io';
    hostInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="smtp-save-button"]').click();
    fixture.detectChanges();

    const patchReq = http.expectOne('/projects/p-1/smtp/smtp-1');
    expect(patchReq.request.method).toBe('PATCH');
    // Only changed field 'host' should be sent
    expect(patchReq.request.body).toEqual({
      host: 'smtp.updated.io',
    });

    patchReq.flush({
      message: 'SMTP updated',
      data: { ...mockSmtp, host: 'smtp.updated.io' },
      success: true,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('smtp.updated.io:587');
  });

  it('deletes an SMTP connection after confirmation', () => {
    const fixture = TestBed.createComponent(SmtpPage);
    fixture.detectChanges();

    http.expectOne('/projects/p-1/smtp?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [mockSmtp], metadata: { page: 1, limit: 20, total: 1 }, success: true });
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="smtp-actions-smtp-1"] button[aria-haspopup="menu"]').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[role="menuitem"]:nth-child(3)').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Delete smtp.mailtrap.io?');

    fixture.nativeElement.querySelector('[data-testid="confirm-delete-smtp-1"]').click();
    fixture.detectChanges();

    const delReq = http.expectOne('/projects/p-1/smtp/smtp-1');
    expect(delReq.request.method).toBe('DELETE');
    delReq.flush({ message: 'deleted', data: null, success: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="smtp-row-smtp-1"]')).toBeNull();
  });


  it('keeps search controls mounted when a query returns no connections', () => {
    const fixture = TestBed.createComponent(SmtpPage);
    fixture.detectChanges();
    http.expectOne('/projects/p-1/smtp?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();
    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    expect(search).not.toBeNull();
    search.value = 'missing';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    http.expectOne('/projects/p-1/smtp?page=1&limit=20&sortBy=createdAt&sortDir=desc&q=missing').flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[type="search"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-list-state="search-empty"]')).not.toBeNull();
  });

  it('opens a read-only detail drawer without exposing a password', () => {
    const fixture = TestBed.createComponent(SmtpPage);
    fixture.detectChanges();
    http.expectOne('/projects/p-1/smtp?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [mockSmtp], metadata: { page: 1, limit: 20, total: 1 }, success: true });
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="smtp-actions-smtp-1"] button[aria-haspopup="menu"]').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[role="menuitem"]:nth-child(1)').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('smtp.mailtrap.io:587');
    expect(fixture.nativeElement.textContent).not.toContain('password');
    expect(fixture.nativeElement.querySelector('input[type="password"]')).toBeNull();
  });

  it('tests SMTP connection successfully without sending a body or recipient', () => {
    const fixture = TestBed.createComponent(SmtpPage);
    fixture.detectChanges();

    http.expectOne('/projects/p-1/smtp?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [mockSmtp], metadata: { page: 1, limit: 20, total: 1 }, success: true });
    fixture.detectChanges();

    const testBtn = fixture.nativeElement.querySelector('[data-testid="smtp-actions-smtp-1"] button[aria-haspopup="menu"]');
    expect(testBtn).not.toBeNull();
    testBtn.click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[role="menuitem"]:nth-child(4)').click();
    fixture.detectChanges();

    const testReq = http.expectOne('/projects/p-1/smtp/smtp-1/test');
    expect(testReq.request.method).toBe('POST');
    expect(testReq.request.body).toBeNull();

    testReq.flush({ message: 'ok', data: { ok: true }, success: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('SMTP test connection successful!');
  });

  it('tests SMTP connection and renders safe error on failure', () => {
    const fixture = TestBed.createComponent(SmtpPage);
    fixture.detectChanges();

    http.expectOne('/projects/p-1/smtp?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [mockSmtp], metadata: { page: 1, limit: 20, total: 1 }, success: true });
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="smtp-actions-smtp-1"] button[aria-haspopup="menu"]').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[role="menuitem"]:nth-child(4)').click();
    fixture.detectChanges();

    const testReq = http.expectOne('/projects/p-1/smtp/smtp-1/test');
    testReq.flush({ message: 'failed', data: { ok: false, error: 'Authentication rejected: 535 Bad credentials' }, success: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('SMTP test failed: Authentication rejected: 535 Bad credentials');
  });

  it('renders the SSL/TLS switch with an accessible name "Use SSL/TLS"', () => {
    const fixture = TestBed.createComponent(SmtpPage);
    fixture.detectChanges();

    http.expectOne('/projects/p-1/smtp?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [], metadata: { page: 1, limit: 20, total: 0 }, success: true });
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="empty-add-smtp-button"]').click();
    fixture.detectChanges();

    const switchEl = fixture.nativeElement.querySelector('[role="switch"]');
    expect(switchEl).not.toBeNull();
    expect(switchEl.getAttribute('aria-label')).toBe('Use SSL/TLS');
  });
});
