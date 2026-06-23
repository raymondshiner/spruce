import { create } from 'zustand';

import { askFollowup, SpruceApiError } from '@/shared/api/client';
import type { ApiErrorKind } from '@/shared/api/types';
import { useProjects } from '@/shared/state/projects';
import { useSession } from '@/shared/state/session';
import { canAskFollowup, type ChatTurn } from '@/shared/types/project';
import type { PlanPatch } from '@/shared/schema/plan';

type ChatStatus =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'error'; error: ApiErrorKind; message?: string; retryable: boolean };

type ChatState = {
  statusByProject: Record<string, ChatStatus>;
  send: (projectId: string, question: string) => Promise<void>;
  clearError: (projectId: string) => void;
};

function applyPatch<T extends { plan: import('@/shared/schema/plan').Plan }>(
  project: T,
  patch: PlanPatch | undefined,
): T {
  if (!patch) return project;
  const plan = { ...project.plan };
  if (patch.updatedVibe) plan.vibe = patch.updatedVibe;
  if (patch.removedItemNames?.length) {
    const remove = new Set(patch.removedItemNames);
    plan.items = plan.items.filter((i) => !remove.has(i.name));
  }
  if (patch.addedItems?.length) {
    plan.items = [...plan.items, ...patch.addedItems];
  }
  return { ...project, plan };
}

export const useChat = create<ChatState>((set, get) => ({
  statusByProject: {},

  clearError: (projectId) => {
    set({ statusByProject: { ...get().statusByProject, [projectId]: { kind: 'idle' } } });
  },

  send: async (projectId, question) => {
    const projects = useProjects.getState();
    const session = useSession.getState();
    const project = projects.byId[projectId];
    if (!project) return;
    if (!canAskFollowup(project)) {
      set({
        statusByProject: {
          ...get().statusByProject,
          [projectId]: {
            kind: 'error',
            error: 'bad_request',
            message: 'Conversation cap reached.',
            retryable: false,
          },
        },
      });
      return;
    }
    if (!session.openaiApiKey) {
      set({
        statusByProject: {
          ...get().statusByProject,
          [projectId]: {
            kind: 'error',
            error: 'invalid_key',
            message: 'Add your OpenAI API key in Settings.',
            retryable: false,
          },
        },
      });
      return;
    }

    set({ statusByProject: { ...get().statusByProject, [projectId]: { kind: 'sending' } } });

    const userTurn: ChatTurn = { role: 'user', content: question, createdAt: Date.now() };
    const optimistic = {
      ...project,
      turns: [...project.turns, userTurn],
      updatedAt: Date.now(),
    };
    await projects.save(optimistic);

    try {
      const device = await session.ensureDeviceRegistered();
      const reply = await askFollowup(device, {
        mode: project.mode,
        zone: project.zone,
        visionSummary: project.visionSummary,
        plan: project.plan,
        turns: optimistic.turns,
        question,
        openaiApiKey: session.openaiApiKey,
      });
      const assistantTurn: ChatTurn = {
        role: 'assistant',
        content: reply.reply,
        createdAt: Date.now(),
      };
      const patched = applyPatch(optimistic, reply.planPatch);
      await projects.save({
        ...patched,
        turns: [...optimistic.turns, assistantTurn],
        updatedAt: Date.now(),
      });
      set({ statusByProject: { ...get().statusByProject, [projectId]: { kind: 'idle' } } });
    } catch (e) {
      const err = e instanceof SpruceApiError ? e : null;
      const kind: ApiErrorKind = err?.kind ?? 'unknown';
      const retryable = kind === 'upstream_unavailable' || kind === 'spruce_rate_limit' || kind === 'network';
      set({
        statusByProject: {
          ...get().statusByProject,
          [projectId]: {
            kind: 'error',
            error: kind,
            message: err?.message,
            retryable,
          },
        },
      });
    }
  },
}));
