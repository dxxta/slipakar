import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { BackButton } from './back-button';

describe('BackButton', () => {
  it('renders an icon-only link with an accessible label and target', async () => {
    await TestBed.configureTestingModule({ imports: [BackButton], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(BackButton);
    fixture.componentRef.setInput('link', ['/projects', 'p-1', 'templates']);
    fixture.componentRef.setInput('label', 'Back to templates');
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('aria-label')).toBe('Back to templates');
    expect(link.textContent?.trim()).toBe('');
    expect(link.classList.contains('h-control-9')).toBe(true);
  });
});
