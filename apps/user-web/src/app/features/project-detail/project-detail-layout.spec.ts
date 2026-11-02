import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { ProjectDetailLayout } from './project-detail-layout';

describe('ProjectDetailLayout', () => {
  it('renders project sections with app-tabs and navigates on tab select', async () => {
    TestBed.configureTestingModule({
      imports: [ProjectDetailLayout],
      providers: [provideRouter([{ path: 'projects/:projectId/overview', component: ProjectDetailLayout }])],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/projects/p-1/overview');

    const fixture = TestBed.createComponent(ProjectDetailLayout);
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelector('app-tabs');
    expect(tabs).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('← All projects');
    expect(fixture.nativeElement.querySelector('app-page-badge')).toBeNull();

    const overviewTab = fixture.nativeElement.querySelector('#tab-overview') as HTMLButtonElement;
    expect(overviewTab).not.toBeNull();
    expect(overviewTab.getAttribute('aria-selected')).toBe('true');
  });
});
