import type { Env } from './env';

type Route = 'plan' | 'followup' | 'visualize';

function limitsFor(env: Env, route: Route): { perHour: number; perDay: number } {
  if (route === 'visualize') {
    return {
      perHour: parseInt(env.RATE_LIMIT_VISUALIZE_PER_HOUR, 10) || 10,
      perDay: parseInt(env.RATE_LIMIT_VISUALIZE_PER_DAY, 10) || 40,
    };
  }
  return {
    perHour: parseInt(env.RATE_LIMIT_PLAN_PER_HOUR, 10) || 60,
    perDay: parseInt(env.RATE_LIMIT_PLAN_PER_DAY, 10) || 500,
  };
}

async function incrCounter(
  env: Env,
  key: string,
  ttlSeconds: number,
): Promise<number> {
  const current = await env.SPRUCE_KV.get(key);
  const next = (current ? parseInt(current, 10) : 0) + 1;
  await env.SPRUCE_KV.put(key, next.toString(), { expirationTtl: ttlSeconds });
  return next;
}

export async function enforceRateLimit(
  env: Env,
  deviceId: string,
  route: Route,
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  const { perHour, perDay } = limitsFor(env, route);
  const bucketHour = Math.floor(Date.now() / 3_600_000);
  const bucketDay = Math.floor(Date.now() / 86_400_000);
  const hourKey = `rl:${route}:${deviceId}:h:${bucketHour}`;
  const dayKey = `rl:${route}:${deviceId}:d:${bucketDay}`;

  const hourCount = await incrCounter(env, hourKey, 3600);
  if (hourCount > perHour) {
    return { allowed: false, retryAfterSeconds: 3600 - (Math.floor(Date.now() / 1000) % 3600) };
  }
  const dayCount = await incrCounter(env, dayKey, 86400);
  if (dayCount > perDay) {
    return { allowed: false, retryAfterSeconds: 86400 - (Math.floor(Date.now() / 1000) % 86400) };
  }
  return { allowed: true };
}
