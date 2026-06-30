import { getDB } from '@/shared/db/db';
import type { Project } from '@/shared/types/project';

export async function listProjects(): Promise<Project[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('projects', 'updatedAt');
  return all.reverse(); // index is ascending; newest first
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await getDB();
  return (await db.get('projects', id)) ?? null;
}

export async function upsertProject(p: Project): Promise<void> {
  const db = await getDB();
  await db.put('projects', p);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('projects', id);
}
