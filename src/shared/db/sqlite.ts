import * as SQLite from 'expo-sqlite';

import type { Project } from '@/shared/types/project';

const DB_NAME = 'spruce.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      mode TEXT NOT NULL,
      thumbnail_uri TEXT NOT NULL,
      photo_sha256 TEXT NOT NULL,
      zone TEXT,
      goal TEXT NOT NULL,
      vision_summary TEXT NOT NULL,
      plan_json TEXT NOT NULL,
      turns_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE INDEX IF NOT EXISTS projects_updated_idx ON projects (updated_at DESC);
  `);
  return db;
}

function db(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

type Row = {
  id: string;
  created_at: number;
  updated_at: number;
  mode: string;
  thumbnail_uri: string;
  photo_sha256: string;
  zone: string | null;
  goal: string;
  vision_summary: string;
  plan_json: string;
  turns_json: string;
};

function rowToProject(r: Row): Project {
  return {
    id: r.id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    mode: r.mode as Project['mode'],
    thumbnailUri: r.thumbnail_uri,
    photoSha256: r.photo_sha256,
    zone: r.zone ?? undefined,
    goal: r.goal,
    visionSummary: r.vision_summary,
    plan: JSON.parse(r.plan_json),
    turns: JSON.parse(r.turns_json),
  };
}

export async function listProjects(): Promise<Project[]> {
  const conn = await db();
  const rows = await conn.getAllAsync<Row>(
    'SELECT * FROM projects ORDER BY updated_at DESC',
  );
  return rows.map(rowToProject);
}

export async function getProject(id: string): Promise<Project | null> {
  const conn = await db();
  const row = await conn.getFirstAsync<Row>('SELECT * FROM projects WHERE id = ?', id);
  return row ? rowToProject(row) : null;
}

export async function upsertProject(p: Project): Promise<void> {
  const conn = await db();
  await conn.runAsync(
    `INSERT INTO projects (
       id, created_at, updated_at, mode, thumbnail_uri, photo_sha256,
       zone, goal, vision_summary, plan_json, turns_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       updated_at = excluded.updated_at,
       plan_json = excluded.plan_json,
       turns_json = excluded.turns_json`,
    p.id,
    p.createdAt,
    p.updatedAt,
    p.mode,
    p.thumbnailUri,
    p.photoSha256,
    p.zone ?? null,
    p.goal,
    p.visionSummary,
    JSON.stringify(p.plan),
    JSON.stringify(p.turns),
  );
}

export async function deleteProject(id: string): Promise<void> {
  const conn = await db();
  await conn.runAsync('DELETE FROM projects WHERE id = ?', id);
}
