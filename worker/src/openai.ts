import { errorResponse } from './http';

const CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const IMAGE_EDIT_URL = 'https://api.openai.com/v1/images/edits';
const IMAGE_GEN_URL = 'https://api.openai.com/v1/images/generations';
const IMAGE_MODEL = 'gpt-image-1';

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
    body.response_format = {
      type: 'json_schema',
      json_schema: { ...args.jsonSchema, strict: true },
    };
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

function statusToFailure(status: number): OpenAIFailure {
  if (status === 401) return { kind: 'invalid_key', status: 401 };
  if (status === 429) return { kind: 'quota', status: 429 };
  return { kind: 'upstream', status };
}

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export type ImageArgs =
  | { mode: 'edit'; apiKey: string; prompt: string; imageBase64: string; size?: string }
  | { mode: 'generate'; apiKey: string; prompt: string; size?: string };

// gpt-image-1 image generation. `edit` runs images/edits over the user's photo (before/after
// render); `generate` runs images/generations (top-down layout diagram). Both return base64.
export async function callOpenAIImage(
  args: ImageArgs,
): Promise<{ ok: true; result: { imageBase64: string } } | { ok: false; failure: OpenAIFailure }> {
  const size = args.size ?? '1024x1024';
  let res: Response;
  try {
    if (args.mode === 'edit') {
      const form = new FormData();
      form.append('model', IMAGE_MODEL);
      form.append('prompt', args.prompt);
      form.append('size', size);
      form.append('n', '1');
      form.append(
        'image',
        new Blob([base64ToBytes(args.imageBase64)], { type: 'image/jpeg' }),
        'photo.jpg',
      );
      res = await fetch(IMAGE_EDIT_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${args.apiKey}` },
        body: form,
      });
    } else {
      res = await fetch(IMAGE_GEN_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${args.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model: IMAGE_MODEL, prompt: args.prompt, size, n: 1 }),
      });
    }
  } catch {
    return { ok: false, failure: { kind: 'upstream', status: 502 } };
  }

  if (!res.ok) return { ok: false, failure: statusToFailure(res.status) };

  const data = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const imageBase64 = data.data?.[0]?.b64_json;
  if (!imageBase64) return { ok: false, failure: { kind: 'upstream', status: 502 } };
  return { ok: true, result: { imageBase64 } };
}

export function failureToResponse(f: OpenAIFailure): Response {
  if (f.kind === 'invalid_key') return errorResponse(401, 'invalid_key', { upstreamCode: 401 });
  if (f.kind === 'quota') return errorResponse(429, 'quota_exceeded', { upstreamCode: 429 });
  return errorResponse(502, 'upstream_unavailable', { upstreamCode: f.status });
}
