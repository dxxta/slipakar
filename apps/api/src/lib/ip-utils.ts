export function isPrivateIp(ip: string | null | undefined): boolean {
  if (!ip || typeof ip !== 'string') return false;

  const trimmed = ip.trim();

  // IPv4 Loopback (127.0.0.0/8)
  if (/^127\./.test(trimmed)) return true;
  // IPv4 Private-Use (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
  if (/^10\./.test(trimmed)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(trimmed)) return true;
  if (/^192\.168\./.test(trimmed)) return true;
  // IPv4 Link-Local (169.254.0.0/16)
  if (/^169\.254\./.test(trimmed)) return true;

  // IPv6 Loopback & Private
  if (trimmed === '::1' || trimmed === '0:0:0:0:0:0:0:1') return true;
  if (/^fe80:/i.test(trimmed)) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(trimmed)) return true;

  return false;
}

/**
 * Resolves whether the connection is behind a proxy (best effort).
 * Private/loopback/docker IPs must NOT set proxy=true.
 * Proxy=true only when the resolved chain has more than one public hop
 * or the IP is public and X-Forwarded-For had >1 entries.
 */
export function resolveProxyFlag({
  ip,
  forwardedFor,
}: {
  ip: string | null | undefined;
  forwardedFor?: string | string[] | null | undefined;
}): boolean {
  if (!ip || isPrivateIp(ip)) {
    return false;
  }

  if (forwardedFor) {
    const raw = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
    const hops = raw.split(',').map((h) => h.trim()).filter(Boolean);
    if (hops.length > 1) {
      return true;
    }
  }

  return false;
}
