import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsPage } from './projects-page';

type Project = {
  id: string;
  name: string;
  rateLimitPerMinute: number;
  maxUploadBytes: number;
  maxRows: number;
  storageQuotaBytes: string;
};
const project: Project = {
  id: 'p-1',
  name: 'Payroll',
  rateLimitPerMinute: 5,
  maxUploadBytes: 5_242_880,
  maxRows: 10_000,
  storageQuotaBytes: '1073741824',
};
const pageEnvelope = (data: Project[], total = data.length) => ({
  message: 'Projects retrieved successfully',
  data,
  metadata: { page: 1, limit: 20, total },
  success: true,
});

describe('ProjectsPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectsPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the signed-in user project list', () => {
    const fixture = TestBed.createComponent(ProjectsPage);
    fixture.detectChanges();
    http.expectOne('/projects?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush(pageEnvelope([project]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Payroll');
    expect(fixture.nativeElement.querySelector('app-page-header')).not.toBeNull();
  });

  it('creates a project using the validated create payload', () => {
    const fixture = TestBed.createComponent(ProjectsPage);
    fixture.detectChanges();
    http.expectOne('/projects?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush(pageEnvelope([]));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-action="new-project"]').click();
    fixture.detectChanges();
    const name = fixture.nativeElement.querySelector('#project-name') as HTMLInputElement;
    name.value = 'Receipts';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-action="save-project"]').click();
    const createRequest = http.expectOne('/projects');
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual({ name: 'Receipts' });
    createRequest.flush({
      message: 'Project created successfully',
      data: { ...project, id: 'p-2', name: 'Receipts' },
      success: true,
    });
  });

  it('navigates to the project overview from the Detail row action', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ProjectsPage);
    fixture.detectChanges();
    http.expectOne('/projects?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush(pageEnvelope([project]));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('tbody [data-row-action-trigger]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const detailBtn = Array.from(fixture.nativeElement.querySelectorAll('button[role="menuitem"]')).find(
      (btn) => (btn as HTMLElement).textContent?.includes('Detail')
    ) as HTMLButtonElement;
    expect(detailBtn).toBeTruthy();
    detailBtn.click();

    expect(navigate).toHaveBeenCalledWith(['/projects/p-1/overview']);
  });

  it('renames a project with a patch request via row action', () => {
    const fixture = TestBed.createComponent(ProjectsPage);
    fixture.detectChanges();
    http.expectOne('/projects?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush(pageEnvelope([project]));
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('tbody [data-row-action-trigger]') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const renameBtn = Array.from(fixture.nativeElement.querySelectorAll('button[role="menuitem"]')).find(
      (btn) => (btn as HTMLElement).textContent?.includes('Rename')
    ) as HTMLButtonElement;
    renameBtn.click();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#project-name') as HTMLInputElement;
    input.value = 'Payroll 2026';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-action="save-project"]').click();
    const updateRequest = http.expectOne('/projects/p-1');
    expect(updateRequest.request.method).toBe('PATCH');
    expect(updateRequest.request.body).toEqual({ name: 'Payroll 2026' });
    updateRequest.flush({
      message: 'Project updated successfully',
      data: { ...project, name: 'Payroll 2026' },
      success: true,
    });
  });

  it('asks for confirmation before deleting a project via row action', () => {
    const fixture = TestBed.createComponent(ProjectsPage);
    fixture.detectChanges();
    http.expectOne('/projects?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush(pageEnvelope([project]));
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('tbody [data-row-action-trigger]') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const deleteBtn = Array.from(fixture.nativeElement.querySelectorAll('button[role="menuitem"]')).find(
      (btn) => (btn as HTMLElement).textContent?.includes('Delete')
    ) as HTMLButtonElement;
    deleteBtn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Delete Payroll?');
    fixture.nativeElement.querySelector('[data-action="confirm"]').click();
    const deleteRequest = http.expectOne('/projects/p-1');
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush({ message: 'Project deleted successfully', data: project, success: true });
  });

  it('shows a retry action when loading fails', () => {
    const fixture = TestBed.createComponent(ProjectsPage);
    fixture.detectChanges();
    http.expectOne('/projects?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush(
      { error: { code: 'INTERNAL', message: 'Unavailable' } },
      { status: 500, statusText: 'Internal Server Error' }
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Could not load projects');
    const retryBtn = fixture.nativeElement.querySelector('button');
    const allButtons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const retry = allButtons.find((b) => b.textContent?.includes('Retry'));
    expect(retry).toBeTruthy();
    retry!.click();
    http.expectOne('/projects?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush(pageEnvelope([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No projects yet');
  });


  it('keeps search and pagination controls mounted when no projects match', () => {
    const fixture = TestBed.createComponent(ProjectsPage);
    fixture.detectChanges();
    http.expectOne('/projects?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush(pageEnvelope([project]));
    fixture.detectChanges();

    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = 'missing';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    http.expectOne('/projects?page=1&limit=20&sortBy=createdAt&sortDir=desc&q=missing').flush(pageEnvelope([], 0));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-data-table-controls')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('select[aria-label="Sort projects"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-list-state="search-empty"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-pagination')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Your projects"]')).toBeNull();
  });

  it('uses the server search and sort query for projects', () => {
    const fixture = TestBed.createComponent(ProjectsPage);
    fixture.detectChanges();
    http.expectOne('/projects?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush(pageEnvelope([project], 25));
    fixture.detectChanges();

    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = ' Payroll ';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    http.expectOne('/projects?page=1&limit=20&sortBy=createdAt&sortDir=desc&q=Payroll').flush(pageEnvelope([project], 25));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('button[appSortHeader="name"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    http.expectOne('/projects?page=1&limit=20&sortBy=name&sortDir=asc&q=Payroll').flush(pageEnvelope([project], 25));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-action="next-page"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    http.expectOne('/projects?page=2&limit=20&sortBy=name&sortDir=asc&q=Payroll').flush({
      ...pageEnvelope([project], 25),
      metadata: { page: 2, limit: 20, total: 25 },
    });
  });
});
