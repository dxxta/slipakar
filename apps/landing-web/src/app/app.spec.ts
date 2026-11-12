import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { LandingHeaderComponent, LandingLanguageToggleComponent } from './home/home-sections';
import { LANDING_CONFIG } from './runtime-config';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('provides the route outlet for the landing pages', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });

  it('renders an accessible Spartan language toggle group with the active language marked', async () => {
    await TestBed.configureTestingModule({
      imports: [LandingHeaderComponent],
      providers: [{ provide: LANDING_CONFIG, useValue: { appUrl: '/', siteUrl: 'https://example.test', repoUrl: '/', docsUrl: '/', statusUrl: '' } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(LandingHeaderComponent);
    fixture.componentRef.setInput('language', 'en');
    fixture.componentRef.setInput('copy', {
      metadata: { path: '/', title: 'Home', description: 'Home' },
      nav: { how: 'How', features: 'Features', signIn: 'Sign in' },
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const group = fixture.nativeElement.querySelector('[role="group"][aria-label="Language"]') as HTMLElement;
    const toggles = [...group.querySelectorAll('button[hlmToggleGroupItem]')] as HTMLButtonElement[];
    expect(toggles.map((toggle) => toggle.textContent?.trim())).toEqual(['ID', 'EN']);
    expect(toggles.map((toggle) => toggle.getAttribute('lang'))).toEqual(['id', 'en']);
    expect(toggles.map((toggle) => toggle.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    expect(toggles.every((toggle) => toggle.getAttribute('class')?.includes('language-option'))).toBe(true);
  });

  it('keeps language links for the matching localized terms path', async () => {
    await TestBed.configureTestingModule({ imports: [LandingLanguageToggleComponent] }).compileComponents();
    const fixture = TestBed.createComponent(LandingLanguageToggleComponent);
    fixture.componentRef.setInput('language', 'id');
    fixture.componentRef.setInput('path', '/id/terms');
    await fixture.whenStable();
    fixture.detectChanges();

    const toggles = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button[hlmToggleGroupItem]')] as HTMLButtonElement[];
    expect(toggles.map((toggle) => toggle.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    expect(fixture.nativeElement.querySelector('[aria-label="Bahasa"]')).not.toBeNull();
  });
});
