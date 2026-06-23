import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import * as Crypto from 'expo-crypto';

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) {
    s += bytes[i].toString(16).padStart(2, '0');
  }
  return s;
}

function sha256Hex(input: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(input)));
}

function hmacSha256Hex(secretHex: string, message: string): string {
  return bytesToHex(hmac(sha256, hexToBytes(secretHex), new TextEncoder().encode(message)));
}

export type SignedRequestHeaders = {
  'x-spruce-device-id': string;
  'x-spruce-timestamp': string;
  'x-spruce-nonce': string;
  'x-spruce-signature': string;
};

export async function signRequest(args: {
  deviceId: string;
  deviceSecret: string;
  method: string;
  path: string;
  body: string;
}): Promise<SignedRequestHeaders> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceSeed = `${timestamp}:${Math.random()}:${args.deviceId}`;
  const nonce = sha256Hex(nonceSeed).slice(0, 24);
  const bodyHash = sha256Hex(args.body);
  const payload = [args.method.toUpperCase(), args.path, bodyHash, timestamp, nonce].join('\n');
  const signature = hmacSha256Hex(args.deviceSecret, payload);
  return {
    'x-spruce-device-id': args.deviceId,
    'x-spruce-timestamp': timestamp,
    'x-spruce-nonce': nonce,
    'x-spruce-signature': signature,
  };
}

export async function generateDeviceSecret(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return bytesToHex(bytes);
}
