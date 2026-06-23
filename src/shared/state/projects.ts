import { create } from 'zustand';

import { deleteProject, listProjects, upsertProject } from '@/shared/db/sqlite';
import type { Project } from '@/shared/types/project';

type ProjectsState = {
  hydrated: boolean;
  byId: Record<string, Project>;
  order: string[];
  hydrate: () => Promise<void>;
  save: (p: Project) => Promise<void>;
  remove: (id: string) => Promise<void>;
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
}));

export function selectProjectList(s: ProjectsState): Project[] {
  return s.order.map((id) => s.byId[id]).filter(Boolean) as Project[];
}
