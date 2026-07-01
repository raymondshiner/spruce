import { getDB } from '@/shared/db/db';
import type { Project } from '@/shared/types/project';

export async function listProjects(): Promise<Project[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('projects', 'updatedAt');
  return all.reverse(); // index is ascending; newest first
}

export async function listProjectsByArea(areaId: string): Promise<Project[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('projects', 'areaId', areaId);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
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

export async function putGeneratedImageBlob(id: string, blob: Blob): Promise<void> {
  const db = await getDB();
  await db.put('generatedImages', blob, id);
}

export async function getGeneratedImageBlob(id: string): Promise<Blob | null> {
  const db = await getDB();
  return (await db.get('generatedImages', id)) ?? null;
}

export async function putChatImageBlob(id: string, blob: Blob): Promise<void> {
  const db = await getDB();
  await db.put('chatImages', blob, id);
}

export async function getChatImageBlob(id: string): Promise<Blob | null> {
  const db = await getDB();
  return (await db.get('chatImages', id)) ?? null;
}
