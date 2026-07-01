import { create } from 'zustand';
import { ulid } from 'ulid';

import { deleteProject, listProjects, putGeneratedImageBlob, upsertProject } from '@/shared/db/projects';
import { base64ToBlob, makeThumbnail } from '@/shared/lib/image';
import type { GeneratedImageKind, Project } from '@/shared/types/project';

type ProjectsState = {
  hydrated: boolean;
  byId: Record<string, Project>;
  order: string[];
  hydrate: () => Promise<void>;
  save: (p: Project) => Promise<void>;
  remove: (id: string) => Promise<void>;
  addGeneratedImage: (
    projectId: string,
    imageBase64: string,
    meta: { kind: GeneratedImageKind; costEstimateUsd: number },
  ) => Promise<void>;
};

function indexProjects(list: Project[]): Pick<ProjectsState, 'byId' | 'order'> {
  const byId: Record<string, Project> = {};
  for (const p of list) byId[p.id] = p;
  const order = list.map((p) => p.id);
  return { byId, order };
}

export const useProjects = create<ProjectsState>((set, get) => ({
  hydrated: false,
  byId: {},
  order: [],

  hydrate: async () => {
    const list = await listProjects();
    set({ hydrated: true, ...indexProjects(list) });
  },

  save: async (p) => {
    await upsertProject(p);
    const next = { ...get().byId, [p.id]: p };
    const list = Object.values(next).sort((a, b) => b.updatedAt - a.updatedAt);
    set(indexProjects(list));
  },

  remove: async (id) => {
    await deleteProject(id);
    const next = { ...get().byId };
    delete next[id];
    const list = Object.values(next).sort((a, b) => b.updatedAt - a.updatedAt);
    set(indexProjects(list));
  },

  addGeneratedImage: async (projectId, imageBase64, meta) => {
    const project = get().byId[projectId];
    if (!project) return;
    const id = ulid();
    const mime = meta.kind === 'render' ? 'image/png' : 'image/png';
    await putGeneratedImageBlob(id, base64ToBlob(imageBase64, mime));
    const thumbnailUri = await makeThumbnail(`data:${mime};base64,${imageBase64}`, 512, 0.72);
    const image = {
      id,
      kind: meta.kind,
      thumbnailUri,
      createdAt: Date.now(),
      costEstimateUsd: meta.costEstimateUsd,
    };
    await get().save({
      ...project,
      generatedImages: [...(project.generatedImages ?? []), image],
      updatedAt: Date.now(),
    });
  },
}));

export function selectProjectList(s: ProjectsState): Project[] {
  return s.order.map((id) => s.byId[id]).filter(Boolean) as Project[];
}

export const selectProjectsInArea = (areaId: string) => (s: ProjectsState): Project[] =>
  s.order.map((id) => s.byId[id]).filter((p): p is Project => Boolean(p) && p.areaId === areaId);
