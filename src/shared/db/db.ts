import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { Project } from '@/shared/types/project';
import type { Area } from '@/shared/types/area';
import { UNASSIGNED_AREA_ID } from '@/shared/types/area';

export type SecureRecord = { iv: number[]; data: number[] };

interface SpruceDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { updatedAt: number; areaId: string };
  };
  areas: {
    key: string;
    value: Area;
    indexes: { parentId: string; updatedAt: number };
  };
  areaPhotos: { key: string; value: Blob };
  generatedImages: { key: string; value: Blob };
  chatImages: { key: string; value: Blob };
  secure: {
    key: string;
    value: SecureRecord;
  };
  crypto: {
    key: string;
    value: CryptoKey;
  };
}

const DB_NAME = 'spruce';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<SpruceDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<SpruceDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SpruceDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        // v1 stores — guarded so a fresh install still creates them.
        if (!db.objectStoreNames.contains('projects')) {
          const store = db.createObjectStore('projects', { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('secure')) {
          db.createObjectStore('secure');
        }
        if (!db.objectStoreNames.contains('crypto')) {
          db.createObjectStore('crypto');
        }

        // v2 additions.
        if (oldVersion < 2) {
          const areas = db.createObjectStore('areas', { keyPath: 'id' });
          areas.createIndex('parentId', 'parentId');
          areas.createIndex('updatedAt', 'updatedAt');
          db.createObjectStore('areaPhotos');
          db.createObjectStore('generatedImages');
          db.createObjectStore('chatImages');

          const projects = tx.objectStore('projects');
          if (!projects.indexNames.contains('areaId')) {
            projects.createIndex('areaId', 'areaId');
          }

          // Seed the undeletable Unassigned area (reassignment fallback).
          const now = Date.now();
          tx.objectStore('areas').put({
            id: UNASSIGNED_AREA_ID,
            parentId: null,
            name: 'Unassigned',
            notes: '',
            photos: [],
            createdAt: now,
            updatedAt: now,
          } satisfies Area);

          // Backfill existing projects with areaId + title, in this same upgrade tx.
          void projects.openCursor().then(function walk(cursor): Promise<void> | void {
            if (!cursor) return;
            const p = cursor.value as Project & { areaId?: string; title?: string };
            void cursor.update({
              ...p,
              areaId: p.areaId ?? UNASSIGNED_AREA_ID,
              title: p.title ?? '',
            });
            return cursor.continue().then(walk);
          });
        }
      },
    });
  }
  return dbPromise;
}
