export function isBlockedSsrfTarget(hostnameOrIp: string): boolean {
  if (!hostnameOrIp) return true;

  const trimmed = hostnameOrIp.trim().toLowerCase();

  // Strip IPv6 brackets if present, e.g. [::1] -> ::1
  const clean = trimmed.startsWith('[') && trimmed.endsWith(']') ? trimmed.slice(1, -1) : trimmed;

  // IPv4 Link-Local / Cloud Metadata (169.254.0.0/16)
  if (/^169\.254\./.test(clean)) return true;

  // IPv6 Link-Local (fe80::/10)
  if (/^fe[89ab][0-9a-f]:/i.test(clean) || clean.startsWith('fe80:')) return true;

  return false;
}

export function validateIntegrationUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are allowed');
  }

  if (parsed.username || parsed.password) {
    throw new Error('Credentials are not allowed in the URL');
  }

  if (isBlockedSsrfTarget(parsed.hostname)) {
    throw new Error('Access to link-local and cloud metadata addresses is forbidden');
  }

  return parsed;
}
