import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { Project } from '@/shared/types/project';

export type SecureRecord = { iv: number[]; data: number[] };

interface SpruceDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { updatedAt: number };
  };
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
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<SpruceDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<SpruceDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SpruceDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
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
      },
    });
  }
  return dbPromise;
}
