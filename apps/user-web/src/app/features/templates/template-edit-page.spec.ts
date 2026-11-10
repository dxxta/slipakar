import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplateEditPage } from './template-edit-page';

describe('TemplateEditPage', () => {
  let http: HttpTestingController;
  let router: Router;
  let templateId: string | null;

  beforeEach(() => {
    templateId = null;
    TestBed.configureTestingModule({
      imports: [TemplateEditPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: { get: (key: string) => key === 'projectId' ? 'p-1' : key === 'templateId' ? templateId : null } }, parent: { snapshot: { paramMap: { get: (key: string) => key === 'projectId' ? 'p-1' : null } } } },
      }],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  it('creates a template on its own page and returns to the template list', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(TemplateEditPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('New email template');
    const name = fixture.nativeElement.querySelector('[data-testid="template-name-input"]') as HTMLInputElement;
    const subject = fixture.nativeElement.querySelector('[data-testid="template-subject-input"]') as HTMLInputElement;
    const body = fixture.nativeElement.querySelector('[data-testid="template-body-textarea"]') as HTMLTextAreaElement;
    name.value = 'Welcome'; name.dispatchEvent(new Event('input'));
    subject.value = 'Hello {{name}}'; subject.dispatchEvent(new Event('input'));
    body.value = '<p>Hi {{name}}</p>'; body.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="template-save-button"]') as HTMLButtonElement).click();
    const request = http.expectOne('/projects/p-1/templates');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'Welcome', subject: 'Hello {{name}}', bodyHtml: '<p>Hi {{name}}</p>' });
    request.flush({ message: 'Created', data: { id: 't-1', projectId: 'p-1', name: 'Welcome', subject: 'Hello {{name}}', bodyHtml: '<p>Hi {{name}}</p>' }, success: true });
    expect(navigate).toHaveBeenCalledWith(['/projects', 'p-1', 'templates']);
  });

  it('loads an existing template and keeps unsafe syntax from being submitted', () => {
    templateId = 't-1';
    const fixture = TestBed.createComponent(TemplateEditPage);
    fixture.detectChanges();
    http.expectOne('/projects/p-1/templates/t-1').flush({ message: 'ok', data: { id: 't-1', projectId: 'p-1', name: 'Payroll', subject: 'Hi', bodyHtml: '{{name}}' }, success: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Edit email template');
    const body = fixture.nativeElement.querySelector('[data-testid="template-body-textarea"]') as HTMLTextAreaElement;
    body.value = '{{#if x}}'; body.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('[data-testid="template-save-button"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('updates an existing template with PATCH and navigates back to the list', () => {
    templateId = 't-2';
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(TemplateEditPage);
    fixture.detectChanges();
    http.expectOne('/projects/p-1/templates/t-2').flush({
      message: 'ok', data: { id: 't-2', projectId: 'p-1', name: 'Payroll', subject: 'Payslip {{period}}', bodyHtml: '<p>{{name}}</p>' }, success: true,
    });
    fixture.detectChanges();
    const name = fixture.nativeElement.querySelector('[data-testid="template-name-input"]') as HTMLInputElement;
    name.value = 'Monthly payroll'; name.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="template-save-button"]') as HTMLButtonElement).click();
    const request = http.expectOne('/projects/p-1/templates/t-2');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ name: 'Monthly payroll', subject: 'Payslip {{period}}', bodyHtml: '<p>{{name}}</p>' });
    request.flush({ message: 'Updated', data: { id: 't-2', projectId: 'p-1', name: 'Monthly payroll', subject: 'Payslip {{period}}', bodyHtml: '<p>{{name}}</p>' }, success: true });
    expect(navigate).toHaveBeenCalledWith(['/projects', 'p-1', 'templates']);
  });

  it('cancels to the templates list without saving', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(TemplateEditPage);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="template-cancel-button"]') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/projects', 'p-1', 'templates']);
    http.expectNone('/projects/p-1/templates');
  });

});
