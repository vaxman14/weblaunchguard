import * as dns from "node:dns/promises";
import * as net from "node:net";

// SSRF defence: validate URL, resolve hostname to a public IP, and bind that
// IP for the actual request so DNS rebinding can't redirect us to a private
// host between validation and connect.

export type BoundAddress = {
  address: string;
  family: 4 | 6;
};

const privateNamePatterns = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /\.lan$/i,
  /\.home$/i,
  /\.test$/i,
  /\.example$/i,
  /\.invalid$/i
];

export function validateTargetUrl(rawUrl: string | undefined): URL {
  if (!rawUrl?.trim()) {
    throw new Error("URL is required.");
  }

  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs can be scanned.");
  }

  return url;
}

function stripIpv6Brackets(hostname: string) {
  return hostname.replace(/^\[/, "").replace(/\]$/, "");
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b, c] = parts;
  // 0.0.0.0/8 (this network), 10/8, 127/8, 169.254/16 (link-local),
  // 172.16/12 (private), 192.0.0/24 (special), 192.0.2/24 (test),
  // 192.88.99/24 (6to4 anycast), 192.168/16 (private),
  // 198.18/15 (benchmarking), 198.51.100/24 (test), 203.0.113/24 (test),
  // 100.64/10 (carrier-grade NAT), 224/4 (multicast + reserved + broadcast).
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 192 && b === 88 && c === 99) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;

  return false;
}

// Expand an IPv6 address into 8 colon-separated 16-bit hex groups.
// Handles `::` compression and ipv4-in-ipv6 trailing dotted form.
function expandIpv6(address: string): number[] | null {
  if (!net.isIPv6(address)) {
    return null;
  }

  let input = address.toLowerCase();

  // ipv4-mapped/embedded: replace trailing a.b.c.d with two hex groups.
  const dottedMatch = input.match(/^(.*?:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dottedMatch) {
    const ipv4 = dottedMatch[2].split(".").map((part) => Number(part));
    if (ipv4.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return null;
    }

    const high = ((ipv4[0] << 8) | ipv4[1]) >>> 0;
    const low = ((ipv4[2] << 8) | ipv4[3]) >>> 0;
    input = `${dottedMatch[1]}${high.toString(16)}:${low.toString(16)}`;
  }

  const parts = input.split("::");
  if (parts.length > 2) {
    return null;
  }

  const left = parts[0] ? parts[0].split(":") : [];
  const right = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const missing = 8 - (left.length + right.length);
  if (missing < 0) {
    return null;
  }

  const middle = new Array<string>(missing).fill("0");
  const groups = [...left, ...middle, ...right];
  if (groups.length !== 8) {
    return null;
  }

  const numeric = groups.map((group) => {
    if (!/^[0-9a-f]{1,4}$/.test(group)) {
      return -1;
    }

    return parseInt(group, 16);
  });

  return numeric.some((value) => value < 0 || value > 0xffff) ? null : numeric;
}

function isPrivateIpv6(address: string): boolean {
  const groups = expandIpv6(address);
  if (!groups) {
    return false;
  }

  // Loopback ::1
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) {
    return true;
  }

  // Unspecified ::
  if (groups.every((group) => group === 0)) {
    return true;
  }

  // IPv4-mapped ::ffff:0:0/96 — extract embedded IPv4 and check.
  if (
    groups[0] === 0 &&
    groups[1] === 0 &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0xffff
  ) {
    const a = groups[6] >> 8;
    const b = groups[6] & 0xff;
    const c = groups[7] >> 8;
    const d = groups[7] & 0xff;
    return isPrivateIpv4(`${a}.${b}.${c}.${d}`);
  }

  // IPv4-compatible ::a.b.c.d (deprecated but still risky).
  if (
    groups[0] === 0 &&
    groups[1] === 0 &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0 &&
    (groups[6] !== 0 || groups[7] !== 0)
  ) {
    const a = groups[6] >> 8;
    const b = groups[6] & 0xff;
    const c = groups[7] >> 8;
    const d = groups[7] & 0xff;
    return isPrivateIpv4(`${a}.${b}.${c}.${d}`);
  }

  // Discard prefix 100::/64
  if (groups[0] === 0x100 && groups[1] === 0 && groups[2] === 0 && groups[3] === 0) {
    return true;
  }

  // Documentation 2001:db8::/32
  if (groups[0] === 0x2001 && groups[1] === 0xdb8) {
    return true;
  }

  // Unique local fc00::/7
  if ((groups[0] & 0xfe00) === 0xfc00) {
    return true;
  }

  // Link-local fe80::/10
  if ((groups[0] & 0xffc0) === 0xfe80) {
    return true;
  }

  // Multicast ff00::/8
  if ((groups[0] & 0xff00) === 0xff00) {
    return true;
  }

  return false;
}

function isPrivateIpAddress(address: string): boolean {
  const stripped = stripIpv6Brackets(address);
  if (net.isIPv4(stripped)) {
    return isPrivateIpv4(stripped);
  }

  if (net.isIPv6(stripped)) {
    return isPrivateIpv6(stripped);
  }

  return false;
}

function isBlockedHostname(hostname: string): boolean {
  if (!hostname) {
    return true;
  }

  if (privateNamePatterns.some((pattern) => pattern.test(hostname))) {
    return true;
  }

  return isPrivateIpAddress(hostname);
}

export async function resolvePublicAddress(url: URL): Promise<BoundAddress> {
  const hostname = stripIpv6Brackets(url.hostname).toLowerCase();

  if (isBlockedHostname(hostname)) {
    throw new Error("Only public URL targets can be scanned.");
  }

  if (net.isIPv4(hostname)) {
    return { address: hostname, family: 4 };
  }

  if (net.isIPv6(hostname)) {
    return { address: hostname, family: 6 };
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length) {
    throw new Error("Only public URL targets can be scanned.");
  }

  if (addresses.some(({ address }) => isPrivateIpAddress(address))) {
    throw new Error("Only public URL targets can be scanned.");
  }

  const first = addresses[0];
  return { address: first.address, family: first.family as 4 | 6 };
}

// Exported for unit tests.
export const __testables = {
  expandIpv6,
  isPrivateIpv4,
  isPrivateIpv6,
  isPrivateIpAddress
};
