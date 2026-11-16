import { Q, type Database, type Model } from '@nozbe/watermelondb';
import { active, bySortOrder, raw } from '../db/rows';
import { isValidSet } from './rules';
import type { SetLog, SetType } from './types';

// Leituras para Progresso e Exercício: sempre derivadas dos treinos FINALIZADOS e não excluídos (RN-16).

export interface ExerciseSession {
  workoutId: string;
  startedAt: number;
  tzOffsetMin: number;
  /** Só séries válidas (RN-08), na ordem do treino. */
  sets: SetLog[];
}
export interface TrainedExercise {
  exerciseId: string;
  name: string;
  sessions: number;
  /** Instante da última série válida. */
  lastAt: number;
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const toLog = (m: Model): SetLog => ({
  type: String(raw(m).set_type) as SetType,
  weightKg: num(raw(m).weight_kg),
  reps: num(raw(m).reps),
  completedAt: num(raw(m).completed_at),
});

/** Sessões de um exercício, da mais antiga à mais nova; sessão sem série válida não entra. */
export async function exerciseSessions(db: Database, exerciseId: string): Promise<ExerciseSession[]> {
  const logs = await db.get<Model>('workout_exercise').query(Q.where('exercise_id', exerciseId), active).fetch();
  if (logs.length === 0) return [];
  const workouts = await db
    .get<Model>('workout')
    .query(Q.where('id', Q.oneOf(logs.map((l) => String(raw(l).workout_id)))), Q.where('status', 'finished'), active)
    .fetch();
  const sets = await db
    .get<Model>('workout_set')
    .query(Q.where('workout_exercise_id', Q.oneOf(logs.map((l) => l.id))), active)
    .fetch();

  return workouts
    .map((w) => {
      const own = logs.filter((l) => raw(l).workout_id === w.id).map((l) => l.id);
      const valid = sets
        .filter((s) => own.includes(String(raw(s).workout_exercise_id)))
        .sort(bySortOrder)
        .map(toLog)
        .filter(isValidSet);
      return { workoutId: w.id, startedAt: Number(raw(w).started_at), tzOffsetMin: Number(raw(w).tz_offset_min), sets: valid };
    })
    .filter((s) => s.sets.length > 0)
    .sort((a, b) => a.startedAt - b.startedAt);
}

/** Exercícios com ao menos uma série válida em treino finalizado, o mais recente primeiro. */
export async function trainedExercises(db: Database): Promise<TrainedExercise[]> {
  const exercises = await db.get<Model>('exercise').query(active).fetch();
  const out: TrainedExercise[] = [];
  for (const ex of exercises) {
    const sessions = await exerciseSessions(db, ex.id);
    if (sessions.length === 0) continue;
    const lastAt = Math.max(...sessions.flatMap((s) => s.sets.map((x) => x.completedAt ?? s.startedAt)));
    out.push({ exerciseId: ex.id, name: String(raw(ex).name), sessions: sessions.length, lastAt });
  }
  return out.sort((a, b) => b.lastAt - a.lastAt);
}
