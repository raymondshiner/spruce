import { create } from 'zustand';

import { askFollowup, SpruceApiError } from '@/shared/api/client';
import type { ApiErrorKind, FollowupImage } from '@/shared/api/types';
import { buildAreaContext } from '@/shared/lib/area-context';
import { trimTurnsForContext } from '@/shared/lib/thread-trim';
import { useAreas } from '@/shared/state/areas';
import { useProjects } from '@/shared/state/projects';
import { useSession } from '@/shared/state/session';
import type { ChatImageRef, ChatTurn } from '@/shared/types/project';
import type { PlanPatch } from '@/shared/schema/plan';

type ChatStatus =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'error'; error: ApiErrorKind; message?: string; retryable: boolean };

export type ChatAttachment = { ref: ChatImageRef; base64: string };

type ChatState = {
  statusByProject: Record<string, ChatStatus>;
  send: (projectId: string, question: string, attachments?: ChatAttachment[]) => Promise<void>;
  clearError: (projectId: string) => void;
};

function applyPatch<T extends { plan: import('@/shared/schema/plan').Plan; visionSummary: string }>(
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
  const visionSummary = patch.updatedVisionSummary ?? project.visionSummary;
  return { ...project, plan, visionSummary };
}

export const useChat = create<ChatState>((set, get) => ({
  statusByProject: {},

  clearError: (projectId) => {
    set({ statusByProject: { ...get().statusByProject, [projectId]: { kind: 'idle' } } });
  },

  send: async (projectId, question, attachments) => {
    const projects = useProjects.getState();
    const session = useSession.getState();
    const project = projects.byId[projectId];
    if (!project) return;
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

    const userTurn: ChatTurn = {
      role: 'user',
      content: question,
      createdAt: Date.now(),
      images: attachments?.length ? attachments.map((a) => a.ref) : undefined,
    };
    const optimistic = {
      ...project,
      turns: [...project.turns, userTurn],
      updatedAt: Date.now(),
    };
    await projects.save(optimistic);

    try {
      const device = await session.ensureDeviceRegistered();
      const areaContext = buildAreaContext(
        project.areaId,
        project.id,
        useAreas.getState().byId,
        Object.values(projects.byId),
      );
      const images: FollowupImage[] | undefined = attachments?.length
        ? attachments.map((a) => ({ base64: a.base64, role: a.ref.role }))
        : undefined;
      const reply = await askFollowup(device, {
        mode: project.mode,
        zone: project.zone,
        visionSummary: project.visionSummary,
        plan: project.plan,
        turns: trimTurnsForContext(optimistic.turns),
        question,
        openaiApiKey: session.openaiApiKey,
        areaContext,
        images,
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
