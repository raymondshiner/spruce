import { getDB } from '@/shared/db/db';
import type { Area } from '@/shared/types/area';
import { UNASSIGNED_AREA_ID } from '@/shared/types/area';

export async function listAreas(): Promise<Area[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('areas', 'updatedAt');
  return all.reverse(); // newest first
}

export async function getArea(id: string): Promise<Area | null> {
  const db = await getDB();
  return (await db.get('areas', id)) ?? null;
}

export async function upsertArea(a: Area): Promise<void> {
  const db = await getDB();
  await db.put('areas', a);
}

// Delete an area and re-home everything that pointed at it to Unassigned:
// its sub-areas become top-level Unassigned's peers, and its projects move to Unassigned.
export async function deleteArea(id: string): Promise<void> {
  if (id === UNASSIGNED_AREA_ID) return; // Unassigned is undeletable
  const db = await getDB();
  const tx = db.transaction(['areas', 'projects'], 'readwrite');
  const areas = tx.objectStore('areas');
  const projects = tx.objectStore('projects');

  // Reassign projects in this area (or its sub-areas) to Unassigned.
  const subAreas = await areas.index('parentId').getAllKeys(id);
  const affectedAreaIds = [id, ...subAreas.map(String)];
  for (const areaId of affectedAreaIds) {
    const inArea = await projects.index('areaId').getAll(areaId);
    for (const p of inArea) {
      await projects.put({ ...p, areaId: UNASSIGNED_AREA_ID, updatedAt: Date.now() });
    }
  }
  // Delete the sub-areas, then the area itself.
  for (const subId of subAreas) await areas.delete(subId);
  await areas.delete(id);
  await tx.done;
}

export async function putAreaPhotoBlob(id: string, blob: Blob): Promise<void> {
  const db = await getDB();
  await db.put('areaPhotos', blob, id);
}

export async function getAreaPhotoBlob(id: string): Promise<Blob | null> {
  const db = await getDB();
  return (await db.get('areaPhotos', id)) ?? null;
}

export async function deleteAreaPhotoBlob(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('areaPhotos', id);
}
