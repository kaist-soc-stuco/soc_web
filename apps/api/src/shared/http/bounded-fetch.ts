import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export class BoundedFetchError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "BoundedFetchError";
  }
}

export async function fetchBoundedText(input: {
  url: string;
  timeoutMs: number;
  maxBytes: number;
  maxRedirects?: number;
  allowedHosts?: ReadonlySet<string>;
  rejectPrivateAddresses?: boolean;
}): Promise<{ response: Response; finalUrl: string; text: string }> {
  const maxRedirects = input.maxRedirects ?? 0;
  let currentUrl = input.url;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const current = new URL(currentUrl);
    await assertFetchTarget(current, input.allowedHosts, input.rejectPrivateAddresses ?? false);

    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(input.timeoutMs),
      });
    } catch {
      throw new BoundedFetchError("external_fetch_failed");
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new BoundedFetchError("external_redirect_location_missing");
      if (redirectCount === maxRedirects) {
        throw new BoundedFetchError("external_redirect_limit_exceeded");
      }
      try {
        currentUrl = new URL(location, current).toString();
      } catch {
        throw new BoundedFetchError("external_redirect_url_invalid");
      }
      continue;
    }

    if (!response.ok) {
      throw new BoundedFetchError(`external_http_${response.status}`);
    }

    const text = await readResponseTextWithLimit(response, input.maxBytes);
    return { response, finalUrl: current.toString(), text };
  }

  throw new BoundedFetchError("external_redirect_limit_exceeded");
}

async function assertFetchTarget(
  url: URL,
  allowedHosts: ReadonlySet<string> | undefined,
  rejectPrivateAddresses: boolean,
): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new BoundedFetchError("external_protocol_not_allowed");
  }
  if (url.username || url.password) {
    throw new BoundedFetchError("external_credentials_not_allowed");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (allowedHosts && !allowedHosts.has(hostname)) {
    throw new BoundedFetchError("external_host_not_allowed");
  }
  if (!rejectPrivateAddresses) return;

  if (isPrivateAddress(hostname)) {
    throw new BoundedFetchError("external_private_address_not_allowed");
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new BoundedFetchError("external_dns_failed");
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new BoundedFetchError("external_private_address_not_allowed");
  }
}

export async function readResponseTextWithLimit(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new BoundedFetchError("external_response_too_large");
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new BoundedFetchError("external_response_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function isPrivateAddress(value: string): boolean {
  const normalized = value.toLowerCase().replace(/^\[|\]$/g, "");
  const version = isIP(normalized);
  if (version === 4) {
    const octets = normalized.split(".").map(Number);
    const [a, b] = octets;
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19));
  }
  if (version === 6) {
    return normalized === "::" || normalized === "::1" ||
      normalized.startsWith("fc") || normalized.startsWith("fd") ||
      normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
      normalized.startsWith("fea") || normalized.startsWith("feb") ||
      normalized.startsWith("ff");
  }
  return ["localhost", "localhost.localdomain"].includes(normalized) ||
    normalized.endsWith(".localhost") || normalized.endsWith(".local");
}
