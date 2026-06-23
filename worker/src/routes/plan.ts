import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

import { errorResponse, jsonResponse } from '../http';
import { callOpenAI, failureToResponse, type ChatMessage } from '../openai';
import { YARD_SYSTEM_PROMPT } from '../prompts/yard';
import {
  FollowupReplySchema,
  PlanSchema,
  ModeSchema,
} from '../../../src/shared/schema/plan';
import type { Env } from '../env';

const MODEL_PLAN = 'gpt-4o';
const MODEL_FOLLOWUP = 'gpt-4o';

const PlanRequestSchema = z.object({
  mode: ModeSchema,
  zone: z.string().optional(),
  goal: z.string().min(1).max(500),
  photoBase64: z.string().min(100),
  openaiApiKey: z.string().min(10),
});

const FollowupRequestSchema = z.object({
  mode: ModeSchema,
  zone: z.string().optional(),
  visionSummary: z.string(),
  plan: PlanSchema,
  turns: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
      createdAt: z.number(),
    }),
  ),
  question: z.string().min(1).max(2000),
  openaiApiKey: z.string().min(10),
});

function planJsonSchema(): Record<string, unknown> {
  return zodToJsonSchema(PlanSchema, { name: 'plan' }) as Record<string, unknown>;
}

function followupJsonSchema(): Record<string, unknown> {
  return zodToJsonSchema(FollowupReplySchema, { name: 'followup' }) as Record<string, unknown>;
}

async function tryParse<T>(
  content: string,
  schema: { safeParse: (x: unknown) => { success: true; data: T } | { success: false } },
): Promise<T | null> {
  try {
    const parsed = schema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function handlePlan(req: Request, env: Env): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return errorResponse(400, 'bad_request');
  }
  const parsed = PlanRequestSchema.safeParse(raw);
  if (!parsed.success) return errorResponse(400, 'bad_request');
  const { goal, zone, photoBase64, openaiApiKey } = parsed.data;

  const zoneLine = zone && zone !== 'unknown' ? `User USDA zone: ${zone}.` : 'User USDA zone: unknown.';
  const messages: ChatMessage[] = [
    { role: 'system', content: YARD_SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: `${zoneLine}\n\nGoal: ${goal}` },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${photoBase64}` } },
      ],
    },
  ];

  let result = await callOpenAI({
    apiKey: openaiApiKey,
    model: MODEL_PLAN,
    messages,
    jsonSchema: { name: 'plan', schema: planJsonSchema() },
    temperature: 0.7,
    maxTokens: 2400,
  });
  if (!result.ok) return failureToResponse(result.failure);

  let plan = await tryParse(result.result.content, PlanSchema);
  if (!plan) {
    const retry = await callOpenAI({
      apiKey: openaiApiKey,
      model: MODEL_PLAN,
      messages: [
        ...messages,
        {
          role: 'system',
          content: 'Your previous response was not valid. Return ONLY a JSON object matching the schema.',
        },
      ],
      jsonSchema: { name: 'plan', schema: planJsonSchema() },
      temperature: 0.4,
      maxTokens: 2400,
    });
    if (!retry.ok) return failureToResponse(retry.failure);
    plan = await tryParse(retry.result.content, PlanSchema);
  }
  if (!plan) return errorResponse(502, 'schema_parse_fail');

  return jsonResponse(plan);
}

export async function handleFollowup(req: Request, env: Env): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return errorResponse(400, 'bad_request');
  }
  const parsed = FollowupRequestSchema.safeParse(raw);
  if (!parsed.success) return errorResponse(400, 'bad_request');
  const { zone, visionSummary, plan, turns, question, openaiApiKey } = parsed.data;

  const zoneLine = zone && zone !== 'unknown' ? `USDA zone: ${zone}.` : 'USDA zone unknown.';
  const context = `${zoneLine}\n\nWhat you saw in the original photo: ${visionSummary}\n\nThe current plan: ${JSON.stringify(plan)}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: YARD_SYSTEM_PROMPT },
    { role: 'system', content: context },
    ...turns.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: question },
  ];

  let result = await callOpenAI({
    apiKey: openaiApiKey,
    model: MODEL_FOLLOWUP,
    messages,
    jsonSchema: { name: 'followup', schema: followupJsonSchema() },
    temperature: 0.6,
    maxTokens: 1600,
  });
  if (!result.ok) return failureToResponse(result.failure);

  let reply = await tryParse(result.result.content, FollowupReplySchema);
  if (!reply) {
    const retry = await callOpenAI({
      apiKey: openaiApiKey,
      model: MODEL_FOLLOWUP,
      messages: [
        ...messages,
        {
          role: 'system',
          content: 'Your previous response was not valid. Return ONLY a JSON object matching the schema.',
        },
      ],
      jsonSchema: { name: 'followup', schema: followupJsonSchema() },
      temperature: 0.4,
      maxTokens: 1600,
    });
    if (!retry.ok) return failureToResponse(retry.failure);
    reply = await tryParse(retry.result.content, FollowupReplySchema);
  }
  if (!reply) return errorResponse(502, 'schema_parse_fail');

  return jsonResponse(reply);
}
