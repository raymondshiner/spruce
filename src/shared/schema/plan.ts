import { z } from 'zod';

export const ItemCategorySchema = z.enum([
  'plant',
  'hardscape',
  'furniture',
  'lighting',
  'decor',
]);
export type ItemCategory = z.infer<typeof ItemCategorySchema>;

export const PlanItemSchema = z.object({
  name: z.string().min(1).max(80),
  category: ItemCategorySchema,
  searchTerms: z.string().min(3).max(120),
  estimatedPriceRange: z.string().max(40).optional(),
  notes: z.string().max(280).optional(),
});
export type PlanItem = z.infer<typeof PlanItemSchema>;

export const PlanSchema = z.object({
  visionSummary: z.string().min(50).max(1500),
  vibe: z.string().min(20).max(400),
  keyChanges: z.array(z.string().min(10).max(300)).min(2).max(7),
  items: z.array(PlanItemSchema).min(3).max(20),
});
export type Plan = z.infer<typeof PlanSchema>;

export const PlanPatchSchema = z.object({
  addedItems: z.array(PlanItemSchema).optional(),
  removedItemNames: z.array(z.string()).optional(),
  updatedVibe: z.string().min(20).max(400).optional(),
});
export type PlanPatch = z.infer<typeof PlanPatchSchema>;

export const FollowupReplySchema = z.object({
  reply: z.string().min(1).max(2000),
  planPatch: PlanPatchSchema.optional(),
});
export type FollowupReply = z.infer<typeof FollowupReplySchema>;

export const ModeSchema = z.enum(['yard', 'indoor']);
export type Mode = z.infer<typeof ModeSchema>;
