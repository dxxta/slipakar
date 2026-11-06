import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FlagsPage } from './flags-page';

describe('FlagsPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [FlagsPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('renders loading skeleton while flags are being fetched', async () => {
    const fixture = TestBed.createComponent(FlagsPage);
    fixture.detectChanges();

    const skeleton = fixture.nativeElement.querySelector('[data-testid="flags-loading-skeleton"]');
    expect(skeleton).not.toBeNull();

    const req = http.expectOne('/admin/config');
    expect(req.request.method).toBe('GET');

    req.flush({
      message: 'ok',
      data: [
        { key: 'scalar_docs', value: true },
        { key: 'pdf_builder', value: false },
        { key: 'self_signup', value: true },
      ],
      success: true,
    });
    fixture.detectChanges();

    const skeletonAfter = fixture.nativeElement.querySelector('[data-testid="flags-loading-skeleton"]');
    expect(skeletonAfter).toBeNull();
  });

  it('loads and renders the three flags with human label and descriptions', async () => {
    const fixture = TestBed.createComponent(FlagsPage);
    fixture.detectChanges();

    const req = http.expectOne('/admin/config');
    req.flush({
      message: 'ok',
      data: [
        { key: 'scalar_docs', value: true },
        { key: 'pdf_builder', value: false },
        { key: 'self_signup', value: true },
      ],
      success: true,
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('API docs page at /docs');
    expect(text).toContain('PDF template builder');
    expect(text).toContain('lets new users sign up');

    const scalarCard = fixture.nativeElement.querySelector('[data-testid="flag-card-scalar_docs"]');
    const pdfCard = fixture.nativeElement.querySelector('[data-testid="flag-card-pdf_builder"]');
    const signupCard = fixture.nativeElement.querySelector('[data-testid="flag-card-self_signup"]');

    expect(scalarCard).not.toBeNull();
    expect(pdfCard).not.toBeNull();
    expect(signupCard).not.toBeNull();
  });

  it('exposes each flag switch with its accessible name', async () => {
    const fixture = TestBed.createComponent(FlagsPage);
    fixture.detectChanges();
    http.expectOne('/admin/config').flush({
      message: 'System config retrieved successfully',
      data: [
        { key: 'scalar_docs', value: true },
        { key: 'pdf_builder', value: false },
        { key: 'self_signup', value: true },
      ],
      success: true,
    });
    fixture.detectChanges();

    const scalarSwitch = fixture.nativeElement.querySelector('[role="switch"][aria-label="Scalar documentation"]');
    const pdfSwitch = fixture.nativeElement.querySelector('[role="switch"][aria-label="PDF builder"]');
    const signupSwitch = fixture.nativeElement.querySelector('[role="switch"][aria-label="Self sign-up"]');
    expect(scalarSwitch).not.toBeNull();
    expect(pdfSwitch).not.toBeNull();
    expect(signupSwitch).not.toBeNull();
  });

  it('toggling a flag sends PUT /admin/config/:key with { value: boolean } and shows saved confirmation', async () => {
    const fixture = TestBed.createComponent(FlagsPage);
    fixture.detectChanges();

    const req = http.expectOne('/admin/config');
    req.flush({
      message: 'ok',
      data: [
        { key: 'scalar_docs', value: false },
        { key: 'pdf_builder', value: false },
        { key: 'self_signup', value: false },
      ],
      success: true,
    });
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.flags().scalar_docs).toBe(false);

    // Toggle scalar_docs to true
    component.toggle('scalar_docs', true);
    fixture.detectChanges();

    // Optimistically updated
    expect(component.flags().scalar_docs).toBe(true);

    const putReq = http.expectOne('/admin/config/scalar_docs');
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body).toEqual({ value: true });

    putReq.flush({
      message: 'ok',
      data: { key: 'scalar_docs', value: true },
      success: true,
    });
    fixture.detectChanges();

    expect(component.flags().scalar_docs).toBe(true);
    expect(component.savedState().scalar_docs).toBe(true);

    const scalarCard = fixture.nativeElement.querySelector('[data-testid="flag-card-scalar_docs"]');
    expect(scalarCard.textContent).toContain('Saved');
  });

  it('rolls back optimistic update and shows error alert when PUT fails', async () => {
    const fixture = TestBed.createComponent(FlagsPage);
    fixture.detectChanges();

    const req = http.expectOne('/admin/config');
    req.flush({
      message: 'ok',
      data: [
        { key: 'scalar_docs', value: false },
        { key: 'pdf_builder', value: false },
        { key: 'self_signup', value: false },
      ],
      success: true,
    });
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.toggle('scalar_docs', true);
    fixture.detectChanges();

    expect(component.flags().scalar_docs).toBe(true);

    const putReq = http.expectOne('/admin/config/scalar_docs');
    putReq.flush(
      { error: { code: 'FORBIDDEN', message: 'Permission denied to update config' } },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();

    // Rolled back
    expect(component.flags().scalar_docs).toBe(false);
    expect(component.errorAlert()).toBe('Permission denied to update config');

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert.getAttribute('aria-live')).toBe('polite');
    expect(alert.textContent).toContain('Permission denied to update config');
  });

  it('shows error state with Retry button when GET fails, and clicking Retry reloads', async () => {
    const fixture = TestBed.createComponent(FlagsPage);
    fixture.detectChanges();

    const req = http.expectOne('/admin/config');
    req.flush(
      { error: { code: 'INTERNAL', message: 'Server unavailable' } },
      { status: 500, statusText: 'Internal Server Error' },
    );
    fixture.detectChanges();

    const errorState = fixture.nativeElement.querySelector('[data-testid="flags-error-state"]');
    expect(errorState).not.toBeNull();
    expect(errorState.textContent).toContain('Server unavailable');

    const retryBtn = errorState.querySelector('button') as HTMLButtonElement;
    expect(retryBtn).not.toBeNull();
    expect(retryBtn.textContent).toContain('Retry');

    retryBtn.click();
    fixture.detectChanges();

    const retryReq = http.expectOne('/admin/config');
    retryReq.flush({
      message: 'ok',
      data: [
        { key: 'scalar_docs', value: true },
        { key: 'pdf_builder', value: true },
        { key: 'self_signup', value: true },
      ],
      success: true,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="flags-error-state"]')).toBeNull();
    expect(fixture.componentInstance.flags().scalar_docs).toBe(true);
  });
});
