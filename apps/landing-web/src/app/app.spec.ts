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

  it('renders real, localized language links with the active language marked', async () => {
    await TestBed.configureTestingModule({
      imports: [LandingHeaderComponent],
      providers: [{ provide: LANDING_CONFIG, useValue: { appUrl: '/', siteUrl: 'https://example.test', repoUrl: '/', docsUrl: '/' } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(LandingHeaderComponent);
    fixture.componentRef.setInput('language', 'en');
    fixture.componentRef.setInput('copy', {
      metadata: { path: '/', title: 'Home', description: 'Home' },
      nav: { how: 'How', features: 'Features', signIn: 'Sign in' },
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const group = fixture.nativeElement.querySelector('[aria-label="Language"]') as HTMLElement;
    const links = [...group.querySelectorAll('a')] as HTMLAnchorElement[];
    expect(links.map((link) => link.textContent?.trim())).toEqual(['ID', 'EN']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/id', '/']);
    expect(links.map((link) => link.getAttribute('hreflang'))).toEqual(['id', 'en']);
    expect(links.map((link) => link.getAttribute('lang'))).toEqual(['id', 'en']);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, 'true']);
    expect(links.every((link) => link.getAttribute('aria-pressed') !== null)).toBe(true);
    expect(links.every((link) => link.getAttribute('class')?.includes('language-option'))).toBe(true);
  });

  it('keeps language links for the matching localized terms path', async () => {
    await TestBed.configureTestingModule({ imports: [LandingLanguageToggleComponent] }).compileComponents();
    const fixture = TestBed.createComponent(LandingLanguageToggleComponent);
    fixture.componentRef.setInput('language', 'id');
    fixture.componentRef.setInput('path', '/id/terms');
    await fixture.whenStable();
    fixture.detectChanges();

    const links = [...(fixture.nativeElement as HTMLElement).querySelectorAll('a')] as HTMLAnchorElement[];
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/id/terms', '/terms']);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual(['true', null]);
  });
});
