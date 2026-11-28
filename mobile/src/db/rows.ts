import { Q, type Database, type Model } from '@nozbe/watermelondb';
import { uuidv7 } from './uuid';

// Helpers de linha bruta dos repositórios (rotinas e treino): leitura/escrita pelo raw snake_case, formato do sync.

export type Raw = Record<string, string | number | boolean | null>;
export const raw = (m: Model) => m._raw as unknown as Raw;
/** Filtro de não excluídas (tombstone = deleted_at preenchido). */
export const active = Q.where('deleted_at', null);
export const bySortOrder = (a: Model, b: Model) => Number(raw(a).sort_order) - Number(raw(b).sort_order);

export function setFields(record: Model, fields: Raw) {
  for (const [column, value] of Object.entries(fields)) record._setRaw(column, value);
}

/** Prepara a criação de uma linha sincronizável com id UUID v7 e carimbos do app. */
export function prepareCreate(db: Database, table: string, fields: Raw, now: number): Model {
  return db.get<Model>(table).prepareCreate((record) => {
    record._raw.id = uuidv7(now);
    setFields(record, { ...fields, user_id: null, created_at: now, updated_at: now, deleted_at: null });
  });
}

/**
 * Grava um lote de uma vez. Se falhar, desfaz nos objetos em memória o que o `prepareUpdate` já aplicou
 * (o Watermelon só reverte o disco): volta ao snapshot de cada registro e libera o estado "preparado".
 */
export async function applyBatch(db: Database, ops: Model[], snapshots: [Model, Model['_raw']][]): Promise<void> {
  try {
    await db.batch(ops);
  } catch (error) {
    for (const [record, snapshot] of snapshots) {
      record._raw = snapshot;
      record._preparedState = null;
    }
    throw error;
  }
}
