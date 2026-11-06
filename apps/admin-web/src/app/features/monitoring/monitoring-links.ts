import { environment } from '../../../environments/environment';

export interface MonitoringServiceLink {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly url: string;
  readonly buttonLabel: string;
}

export function getMonitoringLinks(): MonitoringServiceLink[] {
  return [
    {
      id: 'grafana',
      title: 'Grafana dashboards',
      description: 'System and business performance metrics, queues, and delivery rates.',
      url: environment.grafanaUrl,
      buttonLabel: 'Open Grafana',
    },
    {
      id: 'uptime-kuma',
      title: 'Uptime Kuma status',
      description: 'Uptime, response times, and public service health status.',
      url: environment.uptimeKumaUrl,
      buttonLabel: 'Open Uptime Kuma',
    },
    {
      id: 'scalar-docs',
      title: 'API reference',
      description: 'Interactive API reference with Scalar, models, and request samples.',
      url: '/docs',
      buttonLabel: 'Open API reference',
    },
    {
      id: 'openapi-json',
      title: 'OpenAPI JSON',
      description: 'Raw OpenAPI 3.1 specification schema in JSON format.',
      url: '/openapi.json',
      buttonLabel: 'Open OpenAPI JSON',
    },
  ];
}
