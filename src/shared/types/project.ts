import type { Mode, Plan } from '@/shared/schema/plan';

export type ChatImageRef = {
  id: string; // ulid — key into 'chatImages' blob store
  thumbnailUri: string; // small JPEG data URL for inline rendering
  sha256: string;
  createdAt: number;
  role: 'reference' | 'detail'; // 'reference' = inspiration idea; 'detail' = closer shot of the space
};

export type ChatTurn = {
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  images?: ChatImageRef[];
};

export type GeneratedImageKind = 'render' | 'layout';

export type GeneratedImage = {
  id: string; // ulid — key into 'generatedImages' blob store
  kind: GeneratedImageKind; // 'render' = before/after photoreal; 'layout' = top-down diagram
  thumbnailUri: string;
  createdAt: number;
  costEstimateUsd: number;
};

export type Project = {
  id: string;
  createdAt: number;
  updatedAt: number;
  mode: Mode;
  areaId: string; // always set; migrated rows point at UNASSIGNED_AREA_ID
  title: string; // editable display title (falls back to goal)
  thumbnailUri: string;
  photoSha256: string;
  zone?: string;
  goal: string; // original Turn-1 prompt; kept, no longer the sole title
  visionSummary: string;
  plan: Plan;
  turns: ChatTurn[];
  generatedImages?: GeneratedImage[];
};

// Display title for a project, tolerating legacy rows that predate `title`.
export function projectTitle(p: Pick<Project, 'title' | 'goal'>): string {
  return (p.title ?? '').trim() || p.goal || 'Untitled plan';
}
