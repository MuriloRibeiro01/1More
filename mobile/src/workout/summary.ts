import type { Database } from '@nozbe/watermelondb';
import { Model } from '@nozbe/watermelondb';
import { loadWorkout, validSetHistory, type SetSnapshot, type WorkoutSnapshot } from './repository';
import { finishedWorkoutStarts } from './queries';
import { isValidSet, prsForSet, setVolume, workoutDuration } from './rules';
import type { PRType, SetLog } from './types';
import { roundKg } from '../routines/rules';
import { startOfWeek, daysTrainedInWeek } from './week';

// Resumo do treino finalizado (Fase 6): tudo derivado das séries, nada é guardado (RN-16: derivados não sincronizam).

export interface SummaryRecord {
  exerciseId: string;
  name: string;
  weightKg: number | null;
  reps: number | null;
  types: PRType[];
}
export interface WorkoutSummary {
  durationMs: number | null;
  volumeKg: number;
  validSets: number;
  records: SummaryRecord[];
}
export interface LoadedSummary extends WorkoutSummary {
  name: string;
  startedAt: number;
  notes: string | null;
  /** Dias distintos treinados na semana do treino (inclui este). */
  weekDays: number;
}

const PR_ORDER: PRType[] = ['weight', 'oneRm', 'setVolume', 'repsAtWeight'];
const asLog = (s: SetSnapshot): SetLog => ({ type: s.type, weightKg: s.weightKg, reps: s.reps, completedAt: s.completedAt });

/** "52 min" · "1 h 05 min" · "—" sem série concluída. */
export function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  const total = Math.round(ms / 60_000);
  if (total < 60) return `${total} min`;
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')} min`;
}

/** `history`: séries válidas anteriores por exercício. Um recorde por exercício (a última série que bateu algum). */
export function buildSummary(workout: WorkoutSnapshot, history: Record<string, SetLog[]>): WorkoutSummary {
  const logs = workout.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.map(asLog) }));
  const all = logs.flatMap((e) => e.sets);

  const records: SummaryRecord[] = [];
  for (const ex of workout.exercises) {
    const seen: SetLog[] = [];
    const types = new Set<PRType>();
    let last: SetSnapshot | undefined;
    const done = ex.sets.filter((s) => s.completedAt !== null).sort((a, b) => a.completedAt! - b.completedAt!);
    for (const set of done) {
      const prs = prsForSet(asLog(set), [...(history[ex.exerciseId] ?? []), ...seen]);
      if (prs.length) {
        last = set;
        prs.forEach((p) => types.add(p));
      }
      seen.push(asLog(set));
    }
    if (last) {
      records.push({
        exerciseId: ex.exerciseId,
        name: ex.name,
        weightKg: last.weightKg,
        reps: last.reps,
        types: PR_ORDER.filter((p) => types.has(p)),
      });
    }
  }

  return {
    durationMs: workoutDuration(workout.startedAt, logs),
    volumeKg: roundKg(all.reduce((sum, s) => sum + setVolume(s), 0)),
    validSets: all.filter(isValidSet).length,
    records,
  };
}

const DAY_MS = 86_400_000;

export async function loadSummary(db: Database, workoutId: string): Promise<LoadedSummary> {
  const workout = await loadWorkout(db, workoutId);
  const history: Record<string, SetLog[]> = {};
  for (const ex of workout.exercises) {
    history[ex.exerciseId] = await validSetHistory(db, ex.exerciseId, workoutId, workout.startedAt);
  }
  const weekStart = startOfWeek(new Date(workout.startedAt));
  const from = weekStart.getTime() - DAY_MS;
  const starts = await finishedWorkoutStarts(db, from, from + 9 * DAY_MS);

  return {
    ...buildSummary(workout, history),
    name: workout.name,
    startedAt: workout.startedAt,
    notes: workout.notes,
    weekDays: daysTrainedInWeek(starts.map((s) => s.startedAt), weekStart, workout.tzOffsetMin),
  };
}

/** Nota opcional do treino: apara espaços; vazio vira nulo. */
export async function saveNotes(db: Database, workoutId: string, notes: string, now = Date.now()): Promise<void> {
  const value = notes.trim() === '' ? null : notes.trim();
  await db.write(async () => {
    const workout = await db.get<Model>('workout').find(workoutId);
    await workout.update(() => {
      workout._setRaw('notes', value);
      workout._setRaw('updated_at', now);
    });
  });
}
