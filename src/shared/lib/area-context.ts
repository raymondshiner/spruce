import type { AreaContext } from '@/shared/api/types';
import type { Area } from '@/shared/types/area';
import { UNASSIGNED_AREA_ID } from '@/shared/types/area';
import type { Project } from '@/shared/types/project';
import { projectTitle } from '@/shared/types/project';

const MAX_SIBLINGS = 4;

// Assemble compact context from the OTHER projects in the same area, so the AI can keep
// projects in one area cohesive. Summaries only — never full plan.items — to bound tokens.
// `excludeProjectId` drops the current project (pass null when creating a new one).
export function buildAreaContext(
  areaId: string,
  excludeProjectId: string | null,
  areasById: Record<string, Area>,
  allProjects: Project[],
): AreaContext | undefined {
  const area = areasById[areaId];
  if (!area || area.id === UNASSIGNED_AREA_ID) return undefined;

  const siblings = allProjects
    .filter((p) => p.id !== excludeProjectId && p.areaId === areaId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SIBLINGS)
    .map((p) => ({
      title: projectTitle(p),
      vibe: p.plan.vibe,
      keyChanges: p.plan.keyChanges,
      visionSummary: p.visionSummary?.slice(0, 300),
    }));

  return {
    areaName: area.name,
    areaNotes: area.notes.slice(0, 600),
    siblings,
  };
}
