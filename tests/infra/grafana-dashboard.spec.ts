import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildMetrics } from '../../apps/api/src/internal/metrics/metrics.js';

interface GrafanaTarget {
  expr: string;
  [key: string]: unknown;
}

interface GrafanaPanel {
  id: number;
  title: string;
  datasource?: { uid?: string } | string;
  targets?: GrafanaTarget[];
  panels?: GrafanaPanel[];
  [key: string]: unknown;
}

interface GrafanaDashboard {
  uid: string;
  title: string;
  schemaVersion: number;
  refresh: string;
  time?: { from: string; to: string };
  panels: GrafanaPanel[];
}

function flattenPanels(panels: GrafanaPanel[]): GrafanaPanel[] {
  const result: GrafanaPanel[] = [];
  for (const panel of panels) {
    result.push(panel);
    if (Array.isArray(panel.panels)) {
      result.push(...flattenPanels(panel.panels));
    }
  }
  return result;
}

describe('Grafana Dashboard Specification', () => {
  const rootDir = process.cwd();
  const dashboardPath = path.join(rootDir, 'infra/grafana/dashboards/slipakar.json');

  it('dashboard file exists and has valid top-level metadata', () => {
    expect(fs.existsSync(dashboardPath)).toBe(true);
    const content = fs.readFileSync(dashboardPath, 'utf8');
    const parsed: GrafanaDashboard = JSON.parse(content);

    expect(parsed.uid).toBe('slipakar-overview');
    expect(parsed.title).toBe('Slipakar overview');
    expect(parsed.schemaVersion).toBe(39);
    expect(parsed.refresh).toBe('30s');
    expect(parsed.time?.from).toMatch(/now-6h/);
  });

  it('contains at least 8 panels, unique IDs, datasource slipakar-prometheus, and valid targets', () => {
    const content = fs.readFileSync(dashboardPath, 'utf8');
    const parsed: GrafanaDashboard = JSON.parse(content);
    const allPanels = flattenPanels(parsed.panels || []);

    // Filter to leaf/visual panels (excluding rows or non-target panels)
    const metricPanels = allPanels.filter((p) => p.type !== 'row');
    expect(metricPanels.length).toBeGreaterThanOrEqual(8);

    // Unique IDs
    const ids = metricPanels.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);

    // Every panel uses datasource slipakar-prometheus and has non-empty expr
    for (const panel of metricPanels) {
      if (typeof panel.datasource === 'string') {
        expect(panel.datasource).toBe('slipakar-prometheus');
      } else if (panel.datasource) {
        expect(panel.datasource.uid).toBe('slipakar-prometheus');
      } else {
        expect.fail(`Panel ${panel.title || panel.id} has no datasource defined`);
      }

      expect(Array.isArray(panel.targets)).toBe(true);
      expect(panel.targets?.length).toBeGreaterThan(0);
      for (const target of panel.targets || []) {
        expect(typeof target.expr).toBe('string');
        expect(target.expr.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('key consistency: every slipakar_, process_, nodejs_, and up metric used in panel expr exists in rendered metrics', async () => {
    const content = fs.readFileSync(dashboardPath, 'utf8');
    const parsed: GrafanaDashboard = JSON.parse(content);
    const allPanels = flattenPanels(parsed.panels || []);
    const metricPanels = allPanels.filter((p) => p.type !== 'row');

    // Build real metrics and collect rendered metric names
    const metrics = buildMetrics();
    metrics.recordHttpRequest({ method: 'GET', route: '/test', status: 200, durationSeconds: 0.1 });
    metrics.recordEmailResult('sent');
    metrics.recordEmailResult('failed');
    metrics.recordQueueMessage({ queue: 'test-queue', outcome: 'processed' });
    metrics.recordRateLimitWait(1.0);
    metrics.recordCampaignFinished();

    const rendered = await metrics.render();
    const renderedMetricNames = new Set<string>();
    for (const line of rendered.split('\n')) {
      if (line.startsWith('# TYPE ')) {
        const parts = line.split(' ');
        if (parts[2]) {
          renderedMetricNames.add(parts[2].trim());
        }
      }
    }

    // Extract metric names from expressions
    const exprRegex = /(slipakar_[a-zA-Z0-9_]+|process_[a-zA-Z0-9_]+|nodejs_[a-zA-Z0-9_]+|\bup\b)/g;

    for (const panel of metricPanels) {
      for (const target of panel.targets || []) {
        const matches = target.expr.match(exprRegex) || [];
        expect(matches.length).toBeGreaterThan(0);
        for (const metricName of matches) {
          if (metricName === 'up') {
            continue; // Prometheus built-in
          }

          if (metricName.startsWith('slipakar_')) {
            // Histogram buckets/sums/counts
            const baseHistogramName = metricName
              .replace(/_bucket$/, '')
              .replace(/_sum$/, '')
              .replace(/_count$/, '');
            const exists =
              renderedMetricNames.has(metricName) ||
              renderedMetricNames.has(baseHistogramName);
            expect(
              exists,
              `Metric ${metricName} from expr "${target.expr}" in panel "${panel.title}" must exist in buildMetrics output`,
            ).toBe(true);
          } else {
            // process_ or nodejs_
            expect(
              renderedMetricNames.has(metricName),
              `Default metric ${metricName} in panel "${panel.title}" must exist in prom-client default metrics`,
            ).toBe(true);
          }
        }
      }
    }
  });
});
