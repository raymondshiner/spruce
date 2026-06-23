import { handleRegister } from './routes/register';
import { handlePlan, handleFollowup } from './routes/plan';
import { handleVisualize } from './routes/visualize';
import { verifySignature } from './auth';
import { enforceRateLimit } from './ratelimit';
import { logRequest } from './log';
import { CORS_HEADERS, errorResponse } from './http';
import type { Env } from './env';

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startedAt = Date.now();
    const url = new URL(req.url);
    let status = 500;
    let routeId = url.pathname;

    try {
      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      if (req.method !== 'POST') {
        status = 405;
        return errorResponse(405, 'method_not_allowed');
      }

      if (url.pathname === '/v1/register') {
        const res = await handleRegister(req, env);
        status = res.status;
        return res;
      }

      const auth = await verifySignature(req, env);
      if (!auth.ok) {
        status = 401;
        return errorResponse(401, 'auth_failed', { reason: auth.reason });
      }

      let route: 'plan' | 'followup' | 'visualize' | null = null;
      if (url.pathname === '/v1/plan') route = 'plan';
      else if (url.pathname === '/v1/plan/followup') route = 'followup';
      else if (url.pathname === '/v1/visualize') route = 'visualize';

      if (!route) {
        status = 404;
        return errorResponse(404, 'not_found');
      }

      const limit = await enforceRateLimit(env, auth.deviceId, route);
      if (!limit.allowed) {
        status = 429;
        return errorResponse(429, 'spruce_rate_limit', {
          retryAfterSeconds: limit.retryAfterSeconds,
        });
      }

      let res: Response;
      if (route === 'plan') res = await handlePlan(req, env);
      else if (route === 'followup') res = await handleFollowup(req, env);
      else res = await handleVisualize(req, env);
      status = res.status;
      return res;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown';
      ctx.waitUntil(Promise.resolve(console.error('unhandled', message)));
      status = 502;
      return errorResponse(502, 'upstream_unavailable');
    } finally {
      logRequest({
        routeId,
        method: req.method,
        status,
        latencyMs: Date.now() - startedAt,
      });
    }
  },
};
