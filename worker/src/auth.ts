import type { Env } from './env';

type VerifyResult =
  | { ok: true; deviceId: string }
  | { ok: false; reason: 'missing_headers' | 'unknown_device' | 'bad_timestamp' | 'bad_signature' | 'replay' };

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256Hex(secretHex: string, message: string): Promise<string> {
  const keyBytes = new Uint8Array(secretHex.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []);
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let acc = 0;
  for (let i = 0; i < a.length; i += 1) acc |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return acc === 0;
}

export async function verifySignature(req: Request, env: Env): Promise<VerifyResult> {
  const deviceId = req.headers.get('x-spruce-device-id');
  const timestamp = req.headers.get('x-spruce-timestamp');
  const nonce = req.headers.get('x-spruce-nonce');
  const signature = req.headers.get('x-spruce-signature');
  if (!deviceId || !timestamp || !nonce || !signature) {
    return { ok: false, reason: 'missing_headers' };
  }

  const now = Math.floor(Date.now() / 1000);
  const window = parseInt(env.SIGNATURE_WINDOW_SECONDS, 10) || 300;
  if (Math.abs(now - parseInt(timestamp, 10)) > window) {
    return { ok: false, reason: 'bad_timestamp' };
  }

  const secretHex = await env.SPRUCE_KV.get(`device:${deviceId}:secret`);
  if (!secretHex) return { ok: false, reason: 'unknown_device' };

  const url = new URL(req.url);
  const bodyText = await req.clone().text();
  const bodyHash = await sha256Hex(bodyText);
  const payload = ['POST', url.pathname, bodyHash, timestamp, nonce].join('\n');
  const expected = await hmacSha256Hex(secretHex, payload);
  if (!constantTimeEq(expected, signature)) {
    return { ok: false, reason: 'bad_signature' };
  }

  const nonceKey = `nonce:${deviceId}:${nonce}`;
  const seen = await env.SPRUCE_KV.get(nonceKey);
  if (seen) return { ok: false, reason: 'replay' };
  await env.SPRUCE_KV.put(nonceKey, '1', { expirationTtl: window + 60 });

  return { ok: true, deviceId };
}

export async function generateDeviceSecret(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateDeviceId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
