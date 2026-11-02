function parseIpv4Address(address: string): number[] | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  if (octets.some((part, index) => !/^\d{1,3}$/.test(parts[index] ?? '') || part < 0 || part > 255)) return null;
  return octets;
}

export function isPrivateIpAddress(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const address = ip.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (address === '::1' || address.startsWith('fc') || address.startsWith('fd')) return true;

  const mappedIpv4 = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  const octets = parseIpv4Address(mappedIpv4 ?? address);
  if (!octets) return false;

  const [first = 0, second = 0] = octets;
  return first === 10 || first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168);
}
