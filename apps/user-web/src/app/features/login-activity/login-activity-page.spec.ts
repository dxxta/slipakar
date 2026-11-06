import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { LoginActivityService, type LoginActivityItem } from './login-activity.service';
import { LoginActivityPage } from './login-activity-page';

const event: LoginActivityItem = {
  id: 'event-1', userId: 'user-1', ip: '203.0.113.10', proxy: true,
  browser: 'Chrome', os: 'macOS', deviceType: 'Desktop', country: 'ID', region: 'JK', city: 'Jakarta',
  latitude: -6.2, longitude: 106.8, createdAt: '2026-11-08T12:00:00.000Z',
};

describe('LoginActivityPage', () => {
  it('shows best-effort proxy status and fetches map tiles only when opened', async () => {
    const service = { list: vi.fn().mockReturnValue(of({ data: [event], metadata: { page: 1, limit: 20, total: 1 } })) };
    await TestBed.configureTestingModule({ imports: [LoginActivityPage], providers: [{ provide: LoginActivityService, useValue: service }] }).compileComponents();
    const fixture = TestBed.createComponent(LoginActivityPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[aria-label="Possible proxy (best effort)"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('img[src^="https://tile.openstreetmap.org/"]').length).toBe(0);
    (fixture.nativeElement.querySelector('[aria-label="View map for Jakarta, JK, ID"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const tiles = fixture.nativeElement.querySelectorAll('img[src^="https://tile.openstreetmap.org/"]');
    expect(tiles.length).toBe(9);
    expect((tiles[0] as HTMLImageElement).getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    expect((tiles[0] as HTMLImageElement).getAttribute('loading')).toBe('lazy');
    expect(fixture.nativeElement.textContent).toContain('© OpenStreetMap contributors');
    expect(fixture.nativeElement.querySelector('a[href="https://www.openstreetmap.org/copyright"]')).not.toBeNull();
  });


  it('keeps the filter and pagination mounted when a search has no matches', async () => {
    const service = {
      list: vi.fn()
        .mockReturnValueOnce(of({ data: [event], metadata: { page: 1, limit: 20, total: 1 } }))
        .mockReturnValueOnce(of({ data: [], metadata: { page: 1, limit: 20, total: 0 } })),
    };
    await TestBed.configureTestingModule({ imports: [LoginActivityPage], providers: [{ provide: LoginActivityService, useValue: service }] }).compileComponents();
    const fixture = TestBed.createComponent(LoginActivityPage);
    fixture.detectChanges();

    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = 'missing';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-data-table-controls')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-list-state="search-empty"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-pagination')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('table[aria-label="Login activity"]')).toBeNull();
  });

  it('does not offer a map for events without coordinates', async () => {
    const service = { list: vi.fn().mockReturnValue(of({ data: [{ ...event, country: null, region: null, city: null, latitude: null, longitude: null }], metadata: { page: 1, limit: 20, total: 1 } })) };
    await TestBed.configureTestingModule({ imports: [LoginActivityPage], providers: [{ provide: LoginActivityService, useValue: service }] }).compileComponents();
    const fixture = TestBed.createComponent(LoginActivityPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button[aria-label^="View map"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Unknown location');
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
