export const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers':
    'content-type, x-spruce-app-version, x-spruce-device-id, x-spruce-timestamp, x-spruce-nonce, x-spruce-signature',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  });
}

export function errorResponse(
  status: number,
  error: string,
  extras: Record<string, unknown> = {},
): Response {
  return jsonResponse({ error, ...extras }, status);
}
