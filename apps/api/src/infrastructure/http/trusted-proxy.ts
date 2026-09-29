import { BlockList, isIP } from 'node:net';

type AddressType = 'ipv4' | 'ipv6';

function normalizeIpAddress(value: string): string {
  const normalized = value.trim().toLowerCase();
  const mappedIpv4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  return mappedIpv4?.[1] ?? normalized;
}

function addressType(value: string): AddressType {
  const version = isIP(value);
  if (version === 4) return 'ipv4';
  if (version === 6) return 'ipv6';
  throw new Error(`Invalid trusted proxy address: ${value}`);
}

export function createTrustedProxyCheck(
  entries: readonly string[],
  maxHops: number,
): (ip: string, hop: number) => boolean {
  if (!Number.isInteger(maxHops) || maxHops <= 0) {
    throw new Error('TRUST_PROXY_HOPS must be a positive integer');
  }

  const blockList = new BlockList();

  for (const rawEntry of entries) {
    const entry = rawEntry.trim().toLowerCase();
    if (!entry) continue;

    const [rawAddress, rawPrefix, ...rest] = entry.split('/');
    if (rest.length > 0 || !rawAddress || rawPrefix === '') {
      throw new Error(`Invalid trusted proxy address: ${entry}`);
    }

    const address = normalizeIpAddress(rawAddress);
    const type = addressType(address);

    if (rawPrefix === undefined) {
      blockList.addAddress(address, type);
      continue;
    }

    const prefix = Number(rawPrefix);
    const maxPrefix = type === 'ipv4' ? 32 : 128;
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxPrefix) {
      throw new Error(`Invalid trusted proxy CIDR: ${entry}`);
    }
    blockList.addSubnet(address, prefix, type);
  }

  return (ip: string, hop: number) => {
    if (hop >= maxHops) return false;

    const address = normalizeIpAddress(ip);
    const version = isIP(address);
    if (version === 0) return false;
    return blockList.check(address, version === 4 ? 'ipv4' : 'ipv6');
  };
}
