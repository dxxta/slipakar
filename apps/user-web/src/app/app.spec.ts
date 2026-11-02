import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  it('renders the application router outlet without the generated demo', async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('Hello, user-web');
  });
});
