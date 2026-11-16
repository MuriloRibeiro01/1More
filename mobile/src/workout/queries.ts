import { Q, type Database, type Model } from '@nozbe/watermelondb';
import { active, raw } from '../db/rows';
import { listRoutines } from '../routines/repository';

// Leituras do Início do Treinar (rotina do dia e semana). Só treinos finalizados e não excluídos contam como "feitos".

export interface RoutineWithLastDone {
  id: string;
  name: string;
  /** Posição na lista (mais antiga primeiro): desempata a rotina do dia e define a letra A, B… */
  order: number;
  exerciseNames: string[];
  lastDoneAt: number | null;
}

const finished = Q.where('status', 'finished');

export async function listRoutinesWithLastDone(db: Database): Promise<RoutineWithLastDone[]> {
  const routines = await listRoutines(db);
  const workouts = await db.get<Model>('workout').query(finished, active, Q.where('routine_id', Q.notEq(null))).fetch();
  const lastDone = new Map<string, number>();
  for (const w of workouts) {
    const id = String(raw(w).routine_id);
    lastDone.set(id, Math.max(lastDone.get(id) ?? -Infinity, Number(raw(w).started_at)));
  }
  return routines.map((r, order) => ({ ...r, order, lastDoneAt: lastDone.get(r.id) ?? null }));
}

/** Início (UTC) e fuso dos treinos finalizados com `started_at` em [fromMs, toMs), do mais antigo ao mais novo. */
export async function finishedWorkoutStarts(
  db: Database,
  fromMs: number,
  toMs: number,
): Promise<{ startedAt: number; tzOffsetMin: number }[]> {
  const rows = await db.get<Model>('workout').query(finished, active, Q.where('started_at', Q.between(fromMs, toMs - 1))).fetch();
  return rows
    .map((w) => ({ startedAt: Number(raw(w).started_at), tzOffsetMin: Number(raw(w).tz_offset_min) }))
    .sort((a, b) => a.startedAt - b.startedAt);
}
