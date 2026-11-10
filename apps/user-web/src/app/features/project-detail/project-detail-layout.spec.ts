import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { ProjectDetailLayout } from './project-detail-layout';

describe('ProjectDetailLayout', () => {
  it('renders project sections with segmented tabs and navigates on tab select', async () => {
    TestBed.configureTestingModule({
      imports: [ProjectDetailLayout],
      providers: [provideRouter([{ path: 'projects/:projectId/overview', component: ProjectDetailLayout }])],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/projects/p-1/overview');

    const fixture = TestBed.createComponent(ProjectDetailLayout);
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelector('app-segmented-tabs');
    expect(tabs).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('← All projects');
    expect(fixture.nativeElement.querySelector('app-page-badge')).toBeNull();

    const overviewTab = fixture.nativeElement.querySelector('#segmented-tab-overview') as HTMLButtonElement;
    expect(overviewTab).not.toBeNull();
    expect(overviewTab.getAttribute('aria-selected')).toBe('true');
  });

  it('keeps Templates active on the dedicated template editor routes', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ProjectDetailLayout],
      providers: [provideRouter([{ path: 'projects/:projectId/templates/:templateId', component: ProjectDetailLayout }])],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/projects/p-1/templates/tpl-1');
    const fixture = TestBed.createComponent(ProjectDetailLayout);
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('#segmented-tab-templates') as HTMLButtonElement).getAttribute('aria-selected')).toBe('true');
  });

});
