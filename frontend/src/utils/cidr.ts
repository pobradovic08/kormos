/**
 * Parse an IPv4 address string into a 32-bit number.
 * Returns null if invalid.
 */
function parseIPv4(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;

  let result = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0;
}

/**
 * Parse a CIDR string (e.g. "10.0.1.0/24") or bare IP (e.g. "10.0.1.1")
 * into a network address and prefix length.
 * Bare IPs are treated as /32.
 * Returns null if invalid.
 */
function parseCIDR(input: string): { network: number; prefixLen: number } | null {
  const parts = input.split('/');
  if (parts.length > 2) return null;

  const ip = parseIPv4(parts[0]);
  if (ip === null) return null;

  let prefixLen = 32;
  if (parts.length === 2) {
    prefixLen = Number(parts[1]);
    if (!Number.isInteger(prefixLen) || prefixLen < 0 || prefixLen > 32) return null;
  }

  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  const network = (ip & mask) >>> 0;

  return { network, prefixLen };
}

/**
 * Check if prefix A contains prefix B (B is a subnet of A or equal to A).
 * A contains B when A's prefix length <= B's prefix length
 * and B's network, masked to A's prefix length, equals A's network.
 */
function prefixContains(
  a: { network: number; prefixLen: number },
  b: { network: number; prefixLen: number },
): boolean {
  if (a.prefixLen > b.prefixLen) return false;
  if (a.prefixLen === 0) return true;
  const mask = (~0 << (32 - a.prefixLen)) >>> 0;
  return ((b.network & mask) >>> 0) === a.network;
}

/**
 * Check bidirectional containment: does either prefix contain the other?
 */
export function prefixOverlaps(cidrA: string, cidrB: string): boolean {
  const a = parseCIDR(cidrA);
  const b = parseCIDR(cidrB);
  if (!a || !b) return false;
  return prefixContains(a, b) || prefixContains(b, a);
}

/**
 * Check if a search string looks like an IPv4 address or CIDR notation.
 */
export function looksLikeCIDR(input: string): boolean {
  return parseCIDR(input.trim()) !== null;
}
