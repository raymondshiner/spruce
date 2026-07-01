export type AreaPhotoRef = {
  id: string; // ulid — key into 'areaPhotos' blob store
  thumbnailUri: string; // small JPEG data URL for inline rendering
  sha256: string;
  createdAt: number;
};

export type Area = {
  id: string; // ulid
  parentId: string | null; // null = top-level Area; else = sub-area of that Area
  name: string;
  notes: string; // freeform; fed to the AI as cross-project context
  photos: AreaPhotoRef[];
  createdAt: number;
  updatedAt: number;
};

export const UNASSIGNED_AREA_ID = 'area_unassigned';

// Two-level hierarchy only: a project's area may be top-level or a sub-area, but a
// sub-area can never itself be a parent (no grandchildren).
export function canBeParent(a: Area): boolean {
  return a.parentId === null;
}
