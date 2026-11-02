import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectOverviewPage } from './overview-page';

describe('ProjectOverviewPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectOverviewPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } }, parent: { snapshot: { paramMap: { get: () => 'p-1' } } } } }],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads summary cards and the project activity timeline from API pages', () => {
    const fixture = TestBed.createComponent(ProjectOverviewPage);
    fixture.detectChanges();
    http.expectOne('/projects/p-1/campaigns?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [{ status: 'completed' }], metadata: { page: 1, limit: 100, total: 2 }, success: true });
    http.expectOne('/projects/p-1/templates?page=1&limit=1&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [], metadata: { page: 1, limit: 1, total: 4 }, success: true });
    http.expectOne('/projects/p-1/uploads').flush({ message: 'ok', data: [{ id: 'u-1' }], success: true });
    http.expectOne('/projects/p-1/notifications?page=1&limit=1&unread=true&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [], metadata: { page: 1, limit: 1, total: 3 }, success: true });
    http.expectOne('/projects/p-1/activity?page=1&limit=10').flush({ message: 'ok', data: [{ id: 'a-1', entity: 'template', action: 'updated', fieldName: 'name', fieldValue: 'Payroll', createdAt: '2026-11-09T00:00:00.000Z' }], metadata: { page: 1, limit: 10, total: 1 }, success: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('completed');
    expect(fixture.nativeElement.textContent).toContain('Payroll');
    expect(fixture.nativeElement.textContent).toContain('4');
  });

  it('places equal summary cards before the full-width activity timeline', () => {
    const fixture = TestBed.createComponent(ProjectOverviewPage);
    fixture.detectChanges();
    http.expectOne('/projects/p-1/campaigns?page=1&limit=100&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [], metadata: { page: 1, limit: 100, total: 0 }, success: true });
    http.expectOne('/projects/p-1/templates?page=1&limit=1&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [], metadata: { page: 1, limit: 1, total: 0 }, success: true });
    http.expectOne('/projects/p-1/uploads').flush({ message: 'ok', data: [], success: true });
    http.expectOne('/projects/p-1/notifications?page=1&limit=1&unread=true&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [], metadata: { page: 1, limit: 1, total: 0 }, success: true });
    http.expectOne('/projects/p-1/activity?page=1&limit=10').flush({ message: 'ok', data: [], metadata: { page: 1, limit: 10, total: 0 }, success: true });
    fixture.detectChanges();
    const sections = fixture.nativeElement.querySelectorAll('section') as NodeListOf<HTMLElement>;
    expect(sections[0].className).toContain('auto-rows-fr');
    expect(sections[0].querySelectorAll('article')).toHaveLength(5);
    expect(sections[0].querySelector('article.sm\\:col-span-2')).toBeNull();
    expect(sections[1].getAttribute('aria-labelledby')).toBe('activity-heading');
  });
});
