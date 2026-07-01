import { errorResponse } from './http';

const CHAT_URL = 'https://api.openai.com/v1/chat/completions';

export type ChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | {
      role: 'user';
      content: Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >;
    };

export type OpenAIRequestArgs = {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  temperature?: number;
  maxTokens?: number;
};

export type OpenAIResult = {
  content: string;
  promptTokens?: number;
  completionTokens?: number;
};

export type OpenAIFailure = { kind: 'invalid_key' | 'quota' | 'upstream'; status: number };

export async function callOpenAI(
  args: OpenAIRequestArgs,
): Promise<{ ok: true; result: OpenAIResult } | { ok: false; failure: OpenAIFailure }> {
  const body: Record<string, unknown> = {
    model: args.model,
    messages: args.messages,
    temperature: args.temperature ?? 0.7,
    max_tokens: args.maxTokens ?? 2000,
  };
  if (args.jsonSchema) {
    // json_object (not strict json_schema): the system prompt fully specifies the
    // shape, and zod validation + a retry guard the result. Strict json_schema built
    // from zod-to-json-schema fails OpenAI's structured-output rules (every object
    // needs additionalProperties:false and all keys required) and 400s on our
    // optional fields (notes, estimatedPriceRange, planPatch).
    body.response_format = { type: 'json_object' };
  }

  let res: Response;
  try {
    res = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${args.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, failure: { kind: 'upstream', status: 502 } };
  }

  if (res.status === 401) return { ok: false, failure: { kind: 'invalid_key', status: 401 } };
  if (res.status === 429) return { ok: false, failure: { kind: 'quota', status: 429 } };
  if (!res.ok) return { ok: false, failure: { kind: 'upstream', status: res.status } };

  const data = (await res.json()) as {
    choices: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return { ok: false, failure: { kind: 'upstream', status: 502 } };

  return {
    ok: true,
    result: {
      content,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
    },
  };
}

export function failureToResponse(f: OpenAIFailure): Response {
  if (f.kind === 'invalid_key') return errorResponse(401, 'invalid_key', { upstreamCode: 401 });
  if (f.kind === 'quota') return errorResponse(429, 'quota_exceeded', { upstreamCode: 429 });
  return errorResponse(502, 'upstream_unavailable', { upstreamCode: f.status });
}
