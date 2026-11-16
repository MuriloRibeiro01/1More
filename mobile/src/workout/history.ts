import { Q, type Database, type Model } from '@nozbe/watermelondb';
import { active, bySortOrder, raw } from '../db/rows';
import { roundKg } from '../routines/rules';
import { isValidSet, setVolume, workoutDuration } from './rules';
import type { SetLog, SetType } from './types';
import { localDayKey, startOfWeek } from './week';

// Leituras da aba Histórico. Só treinos finalizados, não excluídos e com ≥ 1 série concluída
// (o treino retroativo recém-criado, ainda vazio, não aparece).

export interface HistoryItem {
  id: string;
  name: string;
  startedAt: number;
  tzOffsetMin: number;
  durationMs: number | null;
  validSets: number;
  volumeKg: number;
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function listWorkoutHistory(db: Database): Promise<HistoryItem[]> {
  const workouts = await db.get<Model>('workout').query(Q.where('status', 'finished'), active).fetch();
  if (workouts.length === 0) return [];
  const exercises = await db.get<Model>('workout_exercise').query(Q.where('workout_id', Q.oneOf(workouts.map((w) => w.id))), active).fetch();
  const sets = exercises.length
    ? (await db.get<Model>('workout_set').query(Q.where('workout_exercise_id', Q.oneOf(exercises.map((e) => e.id))), active).fetch()).sort(bySortOrder)
    : [];

  const logOf = (s: Model): SetLog => ({
    type: String(raw(s).set_type) as SetType,
    weightKg: num(raw(s).weight_kg),
    reps: num(raw(s).reps),
    completedAt: num(raw(s).completed_at),
  });
  const setsOfWorkout = new Map<string, SetLog[]>();
  const workoutOfExercise = new Map(exercises.map((e) => [e.id, String(raw(e).workout_id)]));
  for (const s of sets) {
    const workoutId = workoutOfExercise.get(String(raw(s).workout_exercise_id));
    if (workoutId) setsOfWorkout.set(workoutId, [...(setsOfWorkout.get(workoutId) ?? []), logOf(s)]);
  }

  return workouts
    .filter((w) => (setsOfWorkout.get(w.id) ?? []).some((s) => s.completedAt !== null))
    .map((w) => {
      const logs = setsOfWorkout.get(w.id)!;
      const startedAt = Number(raw(w).started_at);
      return {
        id: w.id,
        name: String(raw(w).name),
        startedAt,
        tzOffsetMin: Number(raw(w).tz_offset_min),
        durationMs: workoutDuration(startedAt, [{ exerciseId: '', sets: logs }]),
        validSets: logs.filter(isValidSet).length,
        volumeKg: roundKg(logs.reduce((sum, s) => sum + setVolume(s), 0)),
      };
    })
    .sort((a, b) => b.startedAt - a.startedAt);
}

/** Dia local do treino (RN-24) como Date local à meia-noite. */
export function localDay(item: Pick<HistoryItem, 'startedAt' | 'tzOffsetMin'>): Date {
  const [y, m, d] = localDayKey(item.startedAt, item.tzOffsetMin).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export interface WeekGroup {
  /** Segunda-feira, meia-noite local. */
  weekStart: Date;
  items: HistoryItem[];
}

/** Agrupa por semana (segunda a domingo) pelo dia local de cada treino; grupos e itens do mais novo ao mais antigo. */
export function groupByWeek(items: HistoryItem[]): WeekGroup[] {
  const groups = new Map<number, WeekGroup>();
  for (const item of [...items].sort((a, b) => b.startedAt - a.startedAt)) {
    const weekStart = startOfWeek(localDay(item));
    const group = groups.get(weekStart.getTime()) ?? { weekStart, items: [] };
    group.items.push(item);
    groups.set(weekStart.getTime(), group);
  }
  return [...groups.values()].sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
}

/** 'AAAA-MM-DD' (dia local do treino) → treinos desse dia, o mais novo primeiro. */
export function workoutsByDay(items: HistoryItem[]): Map<string, HistoryItem[]> {
  const days = new Map<string, HistoryItem[]>();
  for (const item of [...items].sort((a, b) => b.startedAt - a.startedAt)) {
    const key = localDayKey(item.startedAt, item.tzOffsetMin);
    days.set(key, [...(days.get(key) ?? []), item]);
  }
  return days;
}

const shortMonth = (d: Date, loc: string) => new Intl.DateTimeFormat(loc, { month: 'short' }).format(d).replace('.', '');

/** "9–15 nov" ou, cruzando o mês, "26 out – 1 nov". */
export function weekRangeLabel(weekStart: Date, loc: string): string {
  const end = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
  if (end.getMonth() === weekStart.getMonth()) return `${weekStart.getDate()}–${end.getDate()} ${shortMonth(end, loc)}`;
  return `${weekStart.getDate()} ${shortMonth(weekStart, loc)} – ${end.getDate()} ${shortMonth(end, loc)}`;
}
