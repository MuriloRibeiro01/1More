import { Q, type Database, type Model } from '@nozbe/watermelondb';
import { active, raw } from '../db/rows';
import { isValidSet } from '../workout/rules';
import { inWeek, weekDayKeys } from '../workout/week';
import type { SetType } from '../workout/types';

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/** Séries válidas por músculo primário nos treinos finalizados da semana [weekStart, +7 dias), maior primeiro (RF-45). */
export async function weeklyMuscleSets(db: Database, weekStart: Date): Promise<{ muscle: string; sets: number }[]> {
  // RN-24: a semana é cortada pelo fuso gravado em cada treino. A janela em UTC é larga (±1 dia) e o filtro é exato.
  const from = weekStart.getTime() - DAY_MS;
  const week = weekDayKeys(weekStart);
  const workouts = (
    await db
      .get<Model>('workout')
      .query(Q.where('status', 'finished'), active, Q.where('started_at', Q.between(from, from + WEEK_MS + 2 * DAY_MS - 1)))
      .fetch()
  ).filter((w) => inWeek(Number(raw(w).started_at), Number(raw(w).tz_offset_min), week));
  if (workouts.length === 0) return [];
  const exercises = await db.get<Model>('workout_exercise').query(Q.where('workout_id', Q.oneOf(workouts.map((w) => w.id))), active).fetch();
  if (exercises.length === 0) return [];
  const sets = await db.get<Model>('workout_set').query(Q.where('workout_exercise_id', Q.oneOf(exercises.map((e) => e.id))), active).fetch();
  const catalog = await db.get<Model>('exercise').query(Q.where('id', Q.oneOf([...new Set(exercises.map((e) => String(raw(e).exercise_id)))]))).fetch();
  const muscleOf = new Map(catalog.map((e) => [e.id, (raw(e).primary_muscle as string | null) ?? 'other']));
  const exerciseOf = new Map(exercises.map((e) => [e.id, String(raw(e).exercise_id)]));

  const count = new Map<string, number>();
  for (const s of sets) {
    const log = {
      type: String(raw(s).set_type) as SetType,
      weightKg: raw(s).weight_kg === null ? null : Number(raw(s).weight_kg),
      reps: raw(s).reps === null ? null : Number(raw(s).reps),
      completedAt: raw(s).completed_at === null ? null : Number(raw(s).completed_at),
    };
    if (!isValidSet(log)) continue;
    const muscle = muscleOf.get(exerciseOf.get(String(raw(s).workout_exercise_id)) ?? '') ?? 'other';
    count.set(muscle, (count.get(muscle) ?? 0) + 1);
  }
  return [...count].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle));
}
