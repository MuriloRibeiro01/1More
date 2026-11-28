import { Q, type Database, type Model } from '@nozbe/watermelondb';
import { active, prepareCreate, raw, setFields } from '../db/rows';
import { normalizeSearch } from './rules';

// Exercício próprio (RF-12/RF-13). O do catálogo é read-only (RN-19): só o que tem is_custom pode ser editado ou arquivado.
// Modo local: user_id nulo, como o catálogo; is_custom distingue. Arquivar = deleted_at (nunca DELETE).

export type TrackingType = 'weight_reps' | 'bodyweight_reps' | 'duration';

export interface CustomExerciseValues {
  name: string;
  primaryMuscle: string | null;
  equipmentCode: string | null;
  trackingType: TrackingType;
}

export type CustomExerciseError = 'empty' | 'too_long' | 'duplicate' | 'not_custom';
/** Mesmo limite do nome da rotina e do campo da tela. */
export const MAX_EXERCISE_NAME = 80;
export class CustomExerciseValidationError extends Error {
  constructor(readonly reason: CustomExerciseError) {
    super(`exercício próprio inválido: ${reason}`);
  }
}

async function assertNameFree(db: Database, name: string, exceptId?: string) {
  const key = normalizeSearch(name);
  if (!key) throw new CustomExerciseValidationError('empty');
  if (name.length > MAX_EXERCISE_NAME) throw new CustomExerciseValidationError('too_long');
  const rows = await db.get<Model>('exercise').query(Q.where('user_id', null), active).fetch();
  if (rows.some((e) => e.id !== exceptId && normalizeSearch(String(raw(e).name)) === key)) {
    throw new CustomExerciseValidationError('duplicate');
  }
}

/** Cria (sem `id`) ou edita (com `id`, só se for próprio) numa transação. Devolve o id. */
export async function saveCustomExercise(
  db: Database,
  values: CustomExerciseValues,
  id?: string,
  now = Date.now(),
): Promise<string> {
  const name = values.name.trim().replace(/\s+/g, ' ');
  return db.write(async () => {
    await assertNameFree(db, name, id);
    const fields = {
      name,
      tracking_type: values.trackingType,
      primary_muscle: values.primaryMuscle,
      equipment_code: values.equipmentCode,
    };
    if (id) {
      const row = await db.get<Model>('exercise').find(id);
      if (raw(row).is_custom !== true) throw new CustomExerciseValidationError('not_custom');
      await row.update(() => setFields(row, { ...fields, updated_at: now }));
      return id;
    }
    const created = prepareCreate(db, 'exercise', { ...fields, secondary_muscles: '[]', is_custom: true }, now);
    await db.batch([created]);
    return created.id;
  });
}

/** Arquiva (tombstone) um exercício próprio; treinos antigos continuam com nome e histórico. */
export async function archiveCustomExercise(db: Database, id: string, now = Date.now()): Promise<void> {
  await db.write(async () => {
    const row = await db.get<Model>('exercise').find(id);
    if (raw(row).is_custom !== true) throw new CustomExerciseValidationError('not_custom');
    await row.update(() => setFields(row, { deleted_at: now, updated_at: now }));
  });
}
