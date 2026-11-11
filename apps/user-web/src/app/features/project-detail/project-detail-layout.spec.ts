import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { describe, expect, it } from 'vitest';
import { ProjectDetailLayout } from './project-detail-layout';

describe('ProjectDetailLayout', () => {
  it('renders project sections with segmented tabs and navigates on tab select', async () => {
    TestBed.configureTestingModule({
      imports: [ProjectDetailLayout],
      providers: [provideRouter([{ path: 'projects/:projectId/overview', component: ProjectDetailLayout }]), provideHttpClient(), provideHttpClientTesting()],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/projects/p-1/overview');

    const fixture = TestBed.createComponent(ProjectDetailLayout);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('/me/api-access').flush({ message: 'ok', data: { active: false, scopes: [] }, success: true });

    const tabs = fixture.nativeElement.querySelector('app-segmented-tabs');
    expect(tabs).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('← All projects');
    expect(fixture.nativeElement.querySelector('app-page-badge')).toBeNull();

    const overviewTab = fixture.nativeElement.querySelector('#segmented-tab-overview') as HTMLButtonElement;
    expect(overviewTab).not.toBeNull();
    expect(overviewTab.getAttribute('aria-selected')).toBe('true');
  });

  it('shows API keys only when the authenticated API access status is active', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ProjectDetailLayout],
      providers: [provideRouter([{ path: 'projects/:projectId/overview', component: ProjectDetailLayout }]), provideHttpClient(), provideHttpClientTesting()],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/projects/p-1/overview');
    const fixture = TestBed.createComponent(ProjectDetailLayout);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('/me/api-access').flush({ message: 'ok', data: { active: true, scopes: [] }, success: true });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#segmented-tab-api-keys')).not.toBeNull();
  });

  it('keeps Templates active on the dedicated template editor routes', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ProjectDetailLayout],
      providers: [provideRouter([{ path: 'projects/:projectId/templates/:templateId', component: ProjectDetailLayout }]), provideHttpClient(), provideHttpClientTesting()],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/projects/p-1/templates/tpl-1');
    const fixture = TestBed.createComponent(ProjectDetailLayout);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('/me/api-access').flush({ message: 'ok', data: { active: false, scopes: [] }, success: true });
    expect((fixture.nativeElement.querySelector('#segmented-tab-templates') as HTMLButtonElement).getAttribute('aria-selected')).toBe('true');
  });

});
