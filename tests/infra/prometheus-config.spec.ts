import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Prometheus & Grafana provisioning configuration', () => {
  const rootDir = process.cwd();
  const prometheusYmlPath = path.join(rootDir, 'infra/prometheus/prometheus.yml');
  const datasourceYmlPath = path.join(rootDir, 'infra/grafana/provisioning/datasources/datasource.yml');
  const dashboardsYmlPath = path.join(rootDir, 'infra/grafana/provisioning/dashboards/dashboards.yml');

  it('prometheus.yml configures slipakar-api scrape job properly without secret leak', () => {
    expect(fs.existsSync(prometheusYmlPath)).toBe(true);
    const content = fs.readFileSync(prometheusYmlPath, 'utf8');

    // Scrape interval & evaluation interval
    expect(content).toMatch(/scrape_interval:\s*15s/);
    expect(content).toMatch(/evaluation_interval:\s*15s/);

    // Job name
    expect(content).toMatch(/job_name:\s*['"]?slipakar-api['"]?/);

    // Metrics path & target
    expect(content).toMatch(/metrics_path:\s*['"]?\/metrics['"]?/);
    expect(content).toMatch(/api:3000/);

    // Authorization & credentials file
    expect(content).toMatch(/type:\s*['"]?Bearer['"]?/);
    expect(content).toMatch(/credentials_file:\s*['"]?\/tmp\/metrics_token['"]?/);

    // Ensure no hardcoded secret token or password is leaked
    expect(content).not.toMatch(/password/i);
    expect(content).not.toMatch(/secret/i);
    expect(content).not.toMatch(/credentials:\s*['"][^'"]+['"]/);
  });

  it('datasource.yml configures Prometheus datasource with proxy access and slipakar-prometheus uid', () => {
    expect(fs.existsSync(datasourceYmlPath)).toBe(true);
    const content = fs.readFileSync(datasourceYmlPath, 'utf8');

    expect(content).toMatch(/apiVersion:\s*1/);
    expect(content).toMatch(/name:\s*['"]?Prometheus['"]?/);
    expect(content).toMatch(/uid:\s*['"]?slipakar-prometheus['"]?/);
    expect(content).toMatch(/type:\s*['"]?prometheus['"]?/);
    expect(content).toMatch(/access:\s*['"]?proxy['"]?/);
    expect(content).toMatch(/url:\s*['"]?http:\/\/prometheus:9090['"]?/);
    expect(content).toMatch(/isDefault:\s*true/);
    expect(content).toMatch(/editable:\s*false/);
  });

  it('dashboards.yml configures dashboard provider reading /var/lib/grafana/dashboards', () => {
    expect(fs.existsSync(dashboardsYmlPath)).toBe(true);
    const content = fs.readFileSync(dashboardsYmlPath, 'utf8');

    expect(content).toMatch(/apiVersion:\s*1/);
    expect(content).toMatch(/name:\s*['"]?Slipakar['"]?/);
    expect(content).toMatch(/folder:\s*['"]?Slipakar['"]?/);
    expect(content).toMatch(/type:\s*['"]?file['"]?/);
    expect(content).toMatch(/path:\s*['"]?\/var\/lib\/grafana\/dashboards['"]?/);
    expect(content).toMatch(/allowUiUpdates:\s*false/);
  });
});
