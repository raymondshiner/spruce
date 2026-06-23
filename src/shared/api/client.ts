import Constants from 'expo-constants';

import { signRequest } from '@/shared/lib/hmac';
import type {
  ApiError,
  FollowupRequest,
  FollowupResponse,
  PlanRequest,
  PlanResponse,
  RegisterRequest,
  RegisterResponse,
  VisualizeRequest,
  VisualizeResponse,
} from '@/shared/api/types';

const PROXY_URL =
  (Constants.expoConfig?.extra as { spruceProxyUrl?: string } | undefined)?.spruceProxyUrl ??
  'http://localhost:8787';

const APP_VERSION = (Constants.expoConfig?.version as string | undefined) ?? '0.1.0';

export class SpruceApiError extends Error {
  readonly kind: ApiError['error'];
  readonly retryAfterSeconds?: number;
  readonly upstreamCode?: number;
  constructor(err: ApiError) {
    super(err.message ?? err.error);
    this.name = 'SpruceApiError';
    this.kind = err.error;
    this.retryAfterSeconds = err.retryAfterSeconds;
    this.upstreamCode = err.upstreamCode;
  }
}

async function rawRequest(
  path: string,
  body: unknown,
  options?: { device?: { deviceId: string; deviceSecret: string } },
): Promise<Response> {
  const bodyStr = JSON.stringify(body);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-spruce-app-version': APP_VERSION,
  };
  if (options?.device) {
    Object.assign(
      headers,
      await signRequest({
        deviceId: options.device.deviceId,
        deviceSecret: options.device.deviceSecret,
        method: 'POST',
        path,
        body: bodyStr,
      }),
    );
  }
  try {
    return await fetch(`${PROXY_URL}${path}`, {
      method: 'POST',
      headers,
      body: bodyStr,
    });
  } catch (e) {
    throw new SpruceApiError({ error: 'network', message: (e as Error).message });
  }
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  let payload: ApiError;
  try {
    payload = (await res.json()) as ApiError;
  } catch {
    payload = { error: 'unknown', upstreamCode: res.status };
  }
  throw new SpruceApiError(payload);
}

export async function registerDevice(): Promise<RegisterResponse> {
  const body: RegisterRequest = { appVersion: APP_VERSION };
  const res = await rawRequest('/v1/register', body);
  return parseOrThrow<RegisterResponse>(res);
}

export async function generatePlan(
  device: { deviceId: string; deviceSecret: string },
  req: PlanRequest,
): Promise<PlanResponse> {
  const res = await rawRequest('/v1/plan', req, { device });
  return parseOrThrow<PlanResponse>(res);
}

export async function askFollowup(
  device: { deviceId: string; deviceSecret: string },
  req: FollowupRequest,
): Promise<FollowupResponse> {
  const res = await rawRequest('/v1/plan/followup', req, { device });
  return parseOrThrow<FollowupResponse>(res);
}

export async function visualizePlan(
  device: { deviceId: string; deviceSecret: string },
  req: VisualizeRequest,
): Promise<VisualizeResponse> {
  const res = await rawRequest('/v1/visualize', req, { device });
  return parseOrThrow<VisualizeResponse>(res);
}
