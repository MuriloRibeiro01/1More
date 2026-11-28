import { Q, type Database, type Model } from '@nozbe/watermelondb';
import { active, prepareCreate, raw, setFields } from '../db/rows';
import { normalizeSearch } from './rules';

// Pastas de rotinas (RF-24, v6). Excluir a pasta é tombstone; as rotinas voltam para "sem pasta" (folder_id nulo).

export interface RoutineFolder {
  id: string;
  name: string;
  order: number;
}

export type FolderError = 'empty' | 'duplicate';
export class FolderValidationError extends Error {
  constructor(readonly reason: FolderError) {
    super(`pasta inválida: ${reason}`);
  }
}
export const MAX_FOLDER_NAME = 60;

const clean = (name: string) => name.trim().replace(/\s+/g, ' ');

async function activeFolders(db: Database): Promise<Model[]> {
  return (await db.get<Model>('routine_folder').query(active).fetch()).sort(
    (a, b) => Number(raw(a).sort_order) - Number(raw(b).sort_order) || a.id.localeCompare(b.id),
  );
}

function assertName(name: string, folders: Model[], exceptId?: string) {
  const key = normalizeSearch(name);
  if (!key) throw new FolderValidationError('empty');
  if (folders.some((f) => f.id !== exceptId && normalizeSearch(String(raw(f).name)) === key)) {
    throw new FolderValidationError('duplicate');
  }
}

export async function listFolders(db: Database): Promise<RoutineFolder[]> {
  return (await activeFolders(db)).map((f, order) => ({ id: f.id, name: String(raw(f).name), order }));
}

/** Pasta de cada rotina ativa (null = sem pasta). Uma pasta já excluída conta como sem pasta. */
export async function routineFolderIds(db: Database): Promise<Map<string, string | null>> {
  const valid = new Set((await activeFolders(db)).map((f) => f.id));
  const routines = await db.get<Model>('routine').query(active).fetch();
  return new Map(
    routines.map((r) => {
      const id = (raw(r).folder_id as string | null) ?? null;
      return [r.id, id && valid.has(id) ? id : null];
    }),
  );
}

export async function createFolder(db: Database, name: string, now = Date.now()): Promise<string> {
  const finalName = clean(name);
  return db.write(async () => {
    const folders = await activeFolders(db);
    assertName(finalName, folders);
    const last = folders[folders.length - 1];
    const created = prepareCreate(db, 'routine_folder', { name: finalName, sort_order: last ? Number(raw(last).sort_order) + 1 : 0 }, now);
    await db.batch([created]);
    return created.id;
  });
}

export async function renameFolder(db: Database, id: string, name: string, now = Date.now()): Promise<void> {
  const finalName = clean(name);
  await db.write(async () => {
    assertName(finalName, await activeFolders(db), id);
    const folder = await db.get<Model>('routine_folder').find(id);
    await folder.update(() => setFields(folder, { name: finalName, updated_at: now }));
  });
}

/** Tombstone da pasta; as rotinas dela continuam vivas e passam a "sem pasta". Uma transação. */
export async function deleteFolder(db: Database, id: string, now = Date.now()): Promise<void> {
  await db.write(async () => {
    const folder = await db.get<Model>('routine_folder').find(id);
    const routines = await db.get<Model>('routine').query(Q.where('folder_id', id)).fetch();
    await db.batch([
      folder.prepareUpdate(() => setFields(folder, { deleted_at: now, updated_at: now })),
      ...routines.map((r) => r.prepareUpdate(() => setFields(r, { folder_id: null, updated_at: now }))),
    ]);
  });
}
