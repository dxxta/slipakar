import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FlagsService } from './flags.service';

describe('FlagsService API contract mapping', () => {
  let service: FlagsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(FlagsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('normalizes real GET items to page flags, ignores unknown keys, and defaults missing keys to false', () => {
    let result: unknown;
    service.getConfig().subscribe((config) => { result = config; });
    const request = http.expectOne('/admin/config');
    expect(request.request.method).toBe('GET');
    request.flush({
      message: 'System config retrieved successfully',
      data: [
        { key: 'scalar_docs', value: true },
        { key: 'unknown_flag', value: true },
      ],
      success: true,
    });

    expect(result).toEqual({ scalar_docs: true, pdf_builder: false, self_signup: false });
  });

  it('sends { value } and returns the real single-item PUT result', () => {
    let result: unknown;
    service.updateFlag('pdf_builder', true).subscribe((item) => { result = item; });
    const request = http.expectOne('/admin/config/pdf_builder');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ value: true });
    request.flush({
      message: 'System config updated successfully',
      data: { key: 'pdf_builder', value: true },
      success: true,
    });

    expect(result).toEqual({ key: 'pdf_builder', value: true });
  });
});
