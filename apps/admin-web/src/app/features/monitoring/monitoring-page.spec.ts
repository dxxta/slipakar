import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { MonitoringPage } from './monitoring-page';

describe('MonitoringPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [MonitoringPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('renders Section 1 service cards with the four links, proper hrefs, target="_blank", and rel="noopener noreferrer"', () => {
    const fixture = TestBed.createComponent(MonitoringPage);
    fixture.detectChanges();

    // Consume initial /health request from ngOnInit / load
    const req = http.expectOne('/health');
    req.flush({ status: 'ok' });
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll('a[target="_blank"]') as NodeListOf<HTMLAnchorElement>;
    expect(links.length).toBe(4);

    const linkData = Array.from(links).map((a) => ({
      href: a.getAttribute('href'),
      target: a.getAttribute('target'),
      rel: a.getAttribute('rel'),
      text: a.textContent?.trim(),
    }));

    // Check Grafana link
    const grafanaLink = linkData.find((l) => l.href === environment.grafanaUrl);
    expect(grafanaLink).toBeDefined();
    expect(grafanaLink?.target).toBe('_blank');
    expect(grafanaLink?.rel).toContain('noopener');
    expect(grafanaLink?.rel).toContain('noreferrer');

    // Check Uptime Kuma link
    const kumaLink = linkData.find((l) => l.href === environment.uptimeKumaUrl);
    expect(kumaLink).toBeDefined();
    expect(kumaLink?.target).toBe('_blank');
    expect(kumaLink?.rel).toContain('noopener');
    expect(kumaLink?.rel).toContain('noreferrer');

    // Check API reference (/docs)
    const docsLink = linkData.find((l) => l.href === '/docs');
    expect(docsLink).toBeDefined();
    expect(docsLink?.target).toBe('_blank');
    expect(docsLink?.rel).toContain('noopener');
    expect(docsLink?.rel).toContain('noreferrer');

    // Check OpenAPI JSON (/openapi.json)
    const openApiLink = linkData.find((l) => l.href === '/openapi.json');
    expect(openApiLink).toBeDefined();
    expect(openApiLink?.target).toBe('_blank');
    expect(openApiLink?.rel).toContain('noopener');
    expect(openApiLink?.rel).toContain('noreferrer');
  });

  it('health success shows Healthy badge', () => {
    const fixture = TestBed.createComponent(MonitoringPage);
    fixture.detectChanges();

    const req = http.expectOne('/health');
    expect(req.request.method).toBe('GET');
    req.flush({ status: 'ok' });
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('[data-testid="health-badge"]');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain('Healthy');

    const lastChecked = fixture.nativeElement.querySelector('[data-testid="last-checked"]');
    expect(lastChecked).not.toBeNull();
    expect(lastChecked.textContent).not.toBe('');
  });

  it('health failure shows Unreachable badge on error', () => {
    const fixture = TestBed.createComponent(MonitoringPage);
    fixture.detectChanges();

    const req = http.expectOne('/health');
    req.flush('Service Unavailable', { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('[data-testid="health-badge"]');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain('Unreachable');
  });

  it('polls health every 30 seconds', () => {
    const fixture = TestBed.createComponent(MonitoringPage);
    fixture.detectChanges();

    // Initial check
    const req1 = http.expectOne('/health');
    req1.flush({ status: 'ok' });
    fixture.detectChanges();

    // Advance 30 seconds
    vi.advanceTimersByTime(30000);
    const req2 = http.expectOne('/health');
    req2.flush({ status: 'ok' });
    fixture.detectChanges();

    // Advance another 30 seconds
    vi.advanceTimersByTime(30000);
    const req3 = http.expectOne('/health');
    req3.flush({ status: 'ok' });
    fixture.detectChanges();
  });

  it('clears the polling timer on destroy', () => {
    const fixture = TestBed.createComponent(MonitoringPage);
    fixture.detectChanges();

    const req1 = http.expectOne('/health');
    req1.flush({ status: 'ok' });
    fixture.detectChanges();

    // Destroy component
    fixture.destroy();

    // Advance 60 seconds - no more HTTP requests should be triggered
    vi.advanceTimersByTime(60000);
    http.expectNone('/health');
  });

  it('manual Refresh button triggers health check', () => {
    const fixture = TestBed.createComponent(MonitoringPage);
    fixture.detectChanges();

    const req1 = http.expectOne('/health');
    req1.flush({ status: 'ok' });
    fixture.detectChanges();

    const refreshBtn = fixture.nativeElement.querySelector('[data-testid="refresh-btn"]') as HTMLButtonElement;
    expect(refreshBtn).not.toBeNull();
    refreshBtn.click();
    fixture.detectChanges();

    const req2 = http.expectOne('/health');
    req2.flush({ status: 'ok' });
    fixture.detectChanges();
  });
});
