export type LandingStatus = 'up' | 'down' | 'unknown';

export function heartbeatUrl(statusUrl: string): string {
  const statusPageUrl = new URL(statusUrl);
  const match = /^\/status\/([^/]+)\/?$/.exec(statusPageUrl.pathname);
  if (!match) throw new Error('LANDING_STATUS_URL must use the /status/<slug> path.');

  return new URL(`/api/status-page/heartbeat/${match[1]}`, statusPageUrl.origin).toString();
}

export function parseHeartbeat(json: unknown): LandingStatus {
  if (!isRecord(json) || !isRecord(json['heartbeatList'])) return 'unknown';

  const monitorHeartbeats = Object.values(json['heartbeatList']);
  if (monitorHeartbeats.length === 0) return 'unknown';

  const latestStatuses = monitorHeartbeats.map((heartbeats) => {
    if (!Array.isArray(heartbeats) || heartbeats.length === 0) return undefined;
    const latest = heartbeats[heartbeats.length - 1];
    return isRecord(latest) ? latest['status'] : undefined;
  });

  if (latestStatuses.includes(0)) return 'down';
  if (latestStatuses.every((status) => status === 1 || status === 3)) return 'up';
  return 'unknown';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
