import type { Mode, Plan } from '@/shared/schema/plan';

export type ChatTurn = {
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
};

export type Project = {
  id: string;
  createdAt: number;
  updatedAt: number;
  mode: Mode;
  thumbnailUri: string;
  photoSha256: string;
  zone?: string;
  goal: string;
  visionSummary: string;
  plan: Plan;
  turns: ChatTurn[];
};

export const MAX_FOLLOWUP_TURNS = 10;

export function userTurnsUsed(project: Pick<Project, 'turns'>): number {
  return project.turns.filter((t) => t.role === 'user').length;
}

export function canAskFollowup(project: Pick<Project, 'turns'>): boolean {
  return userTurnsUsed(project) < MAX_FOLLOWUP_TURNS;
}
