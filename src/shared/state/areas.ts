import { create } from 'zustand';

import { deleteArea, listAreas, upsertArea } from '@/shared/db/areas';
import type { Area } from '@/shared/types/area';

type AreasState = {
  hydrated: boolean;
  byId: Record<string, Area>;
  order: string[];
  hydrate: () => Promise<void>;
  save: (a: Area) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

function indexAreas(list: Area[]): Pick<AreasState, 'byId' | 'order'> {
  const byId: Record<string, Area> = {};
  for (const a of list) byId[a.id] = a;
  const order = list.map((a) => a.id);
  return { byId, order };
}

export const useAreas = create<AreasState>((set, get) => ({
  hydrated: false,
  byId: {},
  order: [],

  hydrate: async () => {
    const list = await listAreas();
    set({ hydrated: true, ...indexAreas(list) });
  },

  save: async (a) => {
    await upsertArea(a);
    const next = { ...get().byId, [a.id]: a };
    const list = Object.values(next).sort((x, y) => y.updatedAt - x.updatedAt);
    set(indexAreas(list));
  },

  remove: async (id) => {
    await deleteArea(id);
    // deleteArea also re-homes projects/sub-areas; re-hydrate to reflect that.
    const list = await listAreas();
    set(indexAreas(list));
  },
}));

export function selectTopLevelAreas(s: AreasState): Area[] {
  return s.order.map((id) => s.byId[id]).filter((a): a is Area => Boolean(a) && a.parentId === null);
}

export const selectSubAreas = (parentId: string) => (s: AreasState): Area[] =>
  Object.values(s.byId)
    .filter((a) => a.parentId === parentId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
