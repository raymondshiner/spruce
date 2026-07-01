import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

import { errorResponse, jsonResponse } from '../http';
import { callOpenAI, failureToResponse, type ChatMessage } from '../openai';
import { YARD_SYSTEM_PROMPT } from '../prompts/yard';
import { AreaContextSchema, renderAreaContext } from '../prompts/area-context';
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
  areaContext: AreaContextSchema.optional(),
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
  areaContext: AreaContextSchema.optional(),
  images: z
    .array(
      z.object({
        base64: z.string().min(100),
        role: z.enum(['reference', 'detail']),
      }),
    )
    .max(4)
    .optional(),
});

function planJsonSchema(): Record<string, unknown> {
  return zodToJsonSchema(PlanSchema, { name: 'plan' }) as Record<string, unknown>;
}

function followupJsonSchema(): Record<string, unknown> {
  return zodToJsonSchema(FollowupReplySchema, { name: 'followup' }) as Record<string, unknown>;
}

// Exact key contract — json_object mode doesn't pin key names, so spell them out.
const PLAN_OUTPUT_CONTRACT = `Return ONLY a JSON object with EXACTLY these keys, in camelCase, and no others:
{
  "visionSummary": string (200-1500 chars; your private memory of the photo),
  "vibe": string (20-400 chars; one or two sentences shown to the user),
  "keyChanges": string[] (2 to 7 entries, each 10-300 chars),
  "items": [
    {
      "name": string (1-80 chars),
      "category": one of "plant" | "hardscape" | "furniture" | "lighting" | "decor",
      "searchTerms": string (3-120 chars; an Amazon-style search query),
      "estimatedPriceRange": string (OPTIONAL, e.g. "$20-50"),
      "notes": string (OPTIONAL, <=280 chars)
    }
  ] (3 to 20 items)
}
No markdown, no code fences, no commentary — just the JSON object.`;

const FOLLOWUP_OUTPUT_CONTRACT = `Return ONLY a JSON object with EXACTLY these keys, in camelCase:
{
  "reply": string (1-2000 chars; the answer to the user, markdown allowed),
  "planPatch": {           // OPTIONAL — include only when you are changing the plan
    "addedItems": [ { "name", "category", "searchTerms", "estimatedPriceRange"?, "notes"? } ],
    "removedItemNames": string[],
    "updatedVibe": string (20-400 chars),
    "updatedVisionSummary": string (OPTIONAL; only if a detail photo changed your understanding)
  }
}
No markdown fences around the JSON — just the object.`;

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
  const { goal, zone, photoBase64, openaiApiKey, areaContext } = parsed.data;

  const zoneLine = zone && zone !== 'unknown' ? `User USDA zone: ${zone}.` : 'User USDA zone: unknown.';
  const messages: ChatMessage[] = [
    { role: 'system', content: YARD_SYSTEM_PROMPT },
    { role: 'system', content: PLAN_OUTPUT_CONTRACT },
    ...(areaContext ? [{ role: 'system' as const, content: renderAreaContext(areaContext) }] : []),
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
  const { zone, visionSummary, plan, turns, question, openaiApiKey, areaContext, images } = parsed.data;

  const zoneLine = zone && zone !== 'unknown' ? `USDA zone: ${zone}.` : 'USDA zone unknown.';
  const context = `${zoneLine}\n\nWhat you saw in the original photo: ${visionSummary}\n\nThe current plan: ${JSON.stringify(plan)}`;

  // When the user attaches photos this turn, send a multimodal user message. A 'detail'
  // photo is a closer look at the space (refine accordingly); a 'reference' photo is
  // inspiration to match. If a detail photo changes your spatial understanding, return an
  // updatedVisionSummary in the planPatch so later turns retain it.
  const userMessage: ChatMessage = images && images.length
    ? {
        role: 'user',
        content: [
          { type: 'text', text: question },
          ...images.map((img) => ({
            type: 'text' as const,
            text: img.role === 'reference'
              ? 'The image below is a reference/inspiration idea to match the vibe of.'
              : 'The image below is a closer look at the actual space — refine the plan accordingly.',
          })),
          ...images.map((img) => ({
            type: 'image_url' as const,
            image_url: { url: `data:image/jpeg;base64,${img.base64}` },
          })),
        ],
      }
    : { role: 'user', content: question };

  const messages: ChatMessage[] = [
    { role: 'system', content: YARD_SYSTEM_PROMPT },
    { role: 'system', content: FOLLOWUP_OUTPUT_CONTRACT },
    ...(areaContext ? [{ role: 'system' as const, content: renderAreaContext(areaContext) }] : []),
    { role: 'system', content: context },
    ...turns.map((t) => ({ role: t.role, content: t.content })),
    userMessage,
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
