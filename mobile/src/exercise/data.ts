import { Q, type Database, type Model } from '@nozbe/watermelondb';
import { active, prepareCreate, raw, setFields } from '../db/rows';

// Leituras e escritas da tela Exercício. A nota fica em exercise_note (o catálogo é read-only, RN-19).

export async function exerciseName(db: Database, exerciseId: string): Promise<string> {
  return String(raw(await db.get<Model>('exercise').find(exerciseId)).name);
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Faixa de reps da rotina mais recente (não excluída) que contém o exercício; null se nenhuma define reps. */
export async function exerciseRepRange(db: Database, exerciseId: string): Promise<{ repsMin: number | null; repsMax: number | null } | null> {
  const links = await db.get<Model>('routine_exercise').query(Q.where('exercise_id', exerciseId), active).fetch();
  if (links.length === 0) return null;
  const routines = await db
    .get<Model>('routine')
    .query(Q.where('id', Q.oneOf(links.map((l) => String(raw(l).routine_id)))), active)
    .fetch();
  // Mais recente por criação; empate pelo id (UUID v7 cresce com o tempo).
  routines.sort((a, b) => Number(raw(b).created_at) - Number(raw(a).created_at) || b.id.localeCompare(a.id));

  // Só a rotina mais recente decide: se ela não define reps, não há faixa (não herda de rotina antiga).
  const routine = routines[0];
  if (!routine) return null;
  const link = links.find((l) => raw(l).routine_id === routine.id)!;
  const sets = await db.get<Model>('routine_set').query(Q.where('routine_exercise_id', link.id), active).fetch();
  const mins = sets.map((s) => num(raw(s).reps_min)).filter((n): n is number => n !== null);
  const maxs = sets.map((s) => num(raw(s).reps_max)).filter((n): n is number => n !== null);
  if (!mins.length && !maxs.length) return null;
  return { repsMin: mins.length ? Math.min(...mins) : null, repsMax: maxs.length ? Math.max(...maxs) : null };
}

async function noteRow(db: Database, exerciseId: string): Promise<Model | undefined> {
  const [row] = await db.get<Model>('exercise_note').query(Q.where('exercise_id', exerciseId)).fetch();
  return row;
}

export async function getExerciseNote(db: Database, exerciseId: string): Promise<string | null> {
  const row = await noteRow(db, exerciseId);
  return row && raw(row).deleted_at === null ? String(raw(row).text) : null;
}

/** Upsert por exercício. Texto vazio/só espaços apaga logicamente (RN-20); escrever de novo reativa a mesma linha. */
export async function saveExerciseNote(db: Database, exerciseId: string, text: string, now = Date.now()): Promise<void> {
  const value = text.trim();
  await db.write(async () => {
    const row = await noteRow(db, exerciseId);
    if (!row) {
      if (value === '') return;
      await db.batch([prepareCreate(db, 'exercise_note', { exercise_id: exerciseId, text: value }, now)]);
      return;
    }
    await row.update(() => setFields(row, value === '' ? { deleted_at: now, updated_at: now } : { text: value, deleted_at: null, updated_at: now }));
  });
}
