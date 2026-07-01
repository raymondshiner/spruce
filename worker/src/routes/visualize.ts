import { z } from 'zod';

import { errorResponse, jsonResponse } from '../http';
import { callOpenAIImage, failureToResponse } from '../openai';
import { PlanSchema, ModeSchema, type Plan } from '../../../src/shared/schema/plan';
import type { Env } from '../env';

const COST_USD = { render: 0.08, layout: 0.06 } as const;

const VisualizeRequestSchema = z.object({
  mode: ModeSchema,
  kind: z.enum(['render', 'layout']),
  plan: PlanSchema,
  photoBase64: z.string().min(100).optional(),
  openaiApiKey: z.string().min(10),
});

function itemList(plan: Plan): string {
  return plan.items.map((i) => i.name).join(', ');
}

function renderPrompt(plan: Plan): string {
  return [
    'Edit this photo of an outdoor space into an inspirational "after" render that applies these changes.',
    `Overall vibe: ${plan.vibe}`,
    `Key changes: ${plan.keyChanges.join('; ')}`,
    `Include, tastefully placed and realistically scaled: ${itemList(plan)}.`,
    'Keep the existing structure, perspective, and boundaries of the space recognizable. Photorealistic, natural daylight.',
  ].join('\n');
}

function layoutPrompt(plan: Plan): string {
  return [
    'Create a clean top-down overhead layout diagram (garden plan view) of an outdoor space showing where key pieces are placed.',
    `Design intent: ${plan.vibe}`,
    `Arrange and label these elements sensibly: ${itemList(plan)}.`,
    'Simple, legible schematic with soft colors and clear labels — not photorealistic.',
  ].join('\n');
}

export async function handleVisualize(req: Request, _env: Env): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return errorResponse(400, 'bad_request');
  }
  const parsed = VisualizeRequestSchema.safeParse(raw);
  if (!parsed.success) return errorResponse(400, 'bad_request');
  const { kind, plan, photoBase64, openaiApiKey } = parsed.data;

  if (kind === 'render' && !photoBase64) return errorResponse(400, 'bad_request');

  const result =
    kind === 'render'
      ? await callOpenAIImage({
          mode: 'edit',
          apiKey: openaiApiKey,
          prompt: renderPrompt(plan),
          imageBase64: photoBase64 as string,
        })
      : await callOpenAIImage({ mode: 'generate', apiKey: openaiApiKey, prompt: layoutPrompt(plan) });

  if (!result.ok) return failureToResponse(result.failure);

  return jsonResponse({ imageBase64: result.result.imageBase64, costEstimateUsd: COST_USD[kind] });
}
