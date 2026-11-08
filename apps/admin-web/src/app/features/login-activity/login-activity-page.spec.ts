import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { LoginActivityService, type LoginActivityItem } from './login-activity.service';
import { LoginActivityPage } from './login-activity-page';

const event: LoginActivityItem = {
  id: 'event-1', userId: 'user-1', userEmail: 'person@example.test', userName: 'Person',
  ip: '203.0.113.10', proxy: false, browser: 'Firefox', os: 'Linux', deviceType: 'Desktop',
  country: 'US', region: 'CA', city: 'San Francisco', latitude: 37.7, longitude: -122.4,
  createdAt: '2026-11-08T12:00:00.000Z',
};

describe('LoginActivityPage', () => {
  it('shows user identity and defers map tile requests until the map opens', async () => {
    const service = { list: vi.fn().mockReturnValue(of({ data: [event], metadata: { page: 1, limit: 20, total: 1 } })) };
    await TestBed.configureTestingModule({ imports: [LoginActivityPage], providers: [{ provide: LoginActivityService, useValue: service }] }).compileComponents();
    const fixture = TestBed.createComponent(LoginActivityPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('table[aria-label="Login activity"]')?.textContent).toContain('person@example.test');
    expect(fixture.nativeElement.querySelectorAll('img[src^="https://tile.openstreetmap.org/"]').length).toBe(0);
    (fixture.nativeElement.querySelector('[aria-label="View map for San Francisco, CA, US"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('img[src^="https://tile.openstreetmap.org/"]').length).toBe(9);
    expect(fixture.nativeElement.textContent).toContain('© OpenStreetMap contributors');
  });

  it('labels private network addresses and hides the proxy signal', async () => {
    const privateEvent = { ...event, ip: '172.18.0.1', proxy: true, country: null, region: null, city: null, latitude: null, longitude: null };
    const service = { list: vi.fn().mockReturnValue(of({ data: [privateEvent], metadata: { page: 1, limit: 20, total: 1 } })) };
    await TestBed.configureTestingModule({ imports: [LoginActivityPage], providers: [{ provide: LoginActivityService, useValue: service }] }).compileComponents();
    const fixture = TestBed.createComponent(LoginActivityPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Local network');
    expect(fixture.nativeElement.querySelector('[aria-label="Possible proxy (best effort)"]')).toBeNull();
    const map = fixture.nativeElement.querySelector('[title="Private network addresses cannot be located"]') as HTMLElement | null;
    expect(map?.textContent).toContain('No map');
  });

  it('labels public addresses without a geo match as unknown location', async () => {
    const publicEvent = { ...event, ip: '203.0.113.44', proxy: false, country: null, region: null, city: null, latitude: null, longitude: null };
    const service = { list: vi.fn().mockReturnValue(of({ data: [publicEvent], metadata: { page: 1, limit: 20, total: 1 } })) };
    await TestBed.configureTestingModule({ imports: [LoginActivityPage], providers: [{ provide: LoginActivityService, useValue: service }] }).compileComponents();
    const fixture = TestBed.createComponent(LoginActivityPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Unknown location');
  });
});
