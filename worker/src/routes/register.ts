import { errorResponse, jsonResponse } from '../http';
import { generateDeviceId, generateDeviceSecret } from '../auth';
import type { Env } from '../env';

export async function handleRegister(req: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'bad_request');
  }
  const appVersion =
    body && typeof body === 'object' && 'appVersion' in body
      ? String((body as { appVersion: unknown }).appVersion)
      : 'unknown';

  const deviceId = generateDeviceId();
  const deviceSecret = await generateDeviceSecret();

  await env.SPRUCE_KV.put(`device:${deviceId}:secret`, deviceSecret, {
    expirationTtl: 60 * 60 * 24 * 365,
  });
  await env.SPRUCE_KV.put(
    `device:${deviceId}:meta`,
    JSON.stringify({ appVersion, registeredAt: Date.now() }),
    { expirationTtl: 60 * 60 * 24 * 365 },
  );

  return jsonResponse({ deviceId, deviceSecret });
}
