import { Q, type Database, type Model } from '@nozbe/watermelondb';
import { active, applyBatch, bySortOrder, prepareCreate, raw, setFields, type Raw } from '../db/rows';
import { DEFAULT_REST_S, roundKg } from '../routines/rules';
import { finishDecision, isValidSet, overlaps, validateRetroactive } from './rules';
import type { ExerciseLog, SetLog, SetType } from './types';

// Persistência do treino (Fase 4). Recebe o Database por parâmetro (app: src/db; testes: LokiJS).
// Toda escrita é uma transação (db.write + um db.batch): a série só "existe" na UI depois de gravada (RNF-02).
// Exclusão sempre lógica (RN-20). Só um treino ativo por aparelho (RN-02).

export class ActiveWorkoutError extends Error {
  constructor(public readonly activeId: string) {
    super('já existe um treino ativo');
    this.name = 'ActiveWorkoutError';
  }
}
/** RN-05: nenhuma série concluída, o treino só pode ser descartado. */
export class NothingToSaveError extends Error {
  constructor() {
    super('treino sem séries concluídas');
    this.name = 'NothingToSaveError';
  }
}
/** RN-06: há séries não concluídas; o chamador precisa escolher `pending`. */
export class PendingSetsError extends Error {
  constructor() {
    super('há séries não concluídas');
    this.name = 'PendingSetsError';
  }
}

/** RN-07: treino retroativo não pode ter data futura. */
export class RetroactiveError extends Error {
  constructor() {
    super('data futura');
    this.name = 'RetroactiveError';
  }
}

export interface SetSnapshot {
  id: string;
  type: SetType;
  weightKg: number | null;
  reps: number | null;
  completedAt: number | null;
}
export interface WorkoutExerciseSnapshot {
  /** id do workout_exercise (identidade da linha). */
  id: string;
  exerciseId: string;
  name: string;
  restSeconds: number;
  sets: SetSnapshot[];
}
export interface WorkoutSnapshot {
  id: string;
  name: string;
  routineId: string | null;
  status: 'active' | 'finished';
  startedAt: number;
  endedAt: number | null;
  tzOffsetMin: number;
  notes: string | null;
  exercises: WorkoutExerciseSnapshot[];
}
export interface ActiveWorkout {
  id: string;
  name: string;
  routineId: string | null;
  startedAt: number;
  /** Início ou última série concluída: base da regra das 4 h (RN-04). */
  lastActivityAt: number;
}

interface PlannedSet {
  type: SetType;
  weightKg: number | null;
  reps: number | null;
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

async function children(db: Database, table: string, column: string, parentIds: string[]) {
  if (parentIds.length === 0) return [];
  const rows = await db.get<Model>(table).query(Q.where(column, Q.oneOf(parentIds)), active).fetch();
  return rows.sort(bySortOrder);
}

async function findActive(db: Database): Promise<Model | undefined> {
  const [row] = await db.get<Model>('workout').query(Q.where('status', 'active'), active).fetch();
  return row;
}

/** Carga e reps das séries concluídas do último treino finalizado com este exercício (a lápis na tela). */
async function lastSessionSets(db: Database, exerciseId: string): Promise<PlannedSet[]> {
  const logs = await db.get<Model>('workout_exercise').query(Q.where('exercise_id', exerciseId), active).fetch();
  if (logs.length === 0) return [];
  const workouts = await db
    .get<Model>('workout')
    .query(Q.where('id', Q.oneOf(logs.map((l) => String(raw(l).workout_id)))), Q.where('status', 'finished'), active)
    .fetch();
  const latest = workouts.sort((a, b) => Number(raw(b).started_at) - Number(raw(a).started_at))[0];
  if (!latest) return [];
  const log = logs.find((l) => raw(l).workout_id === latest.id)!;
  const sets = await children(db, 'workout_set', 'workout_exercise_id', [log.id]);
  return sets
    .filter((s) => raw(s).completed_at !== null)
    // Carga 0 não é sugestão útil: o campo nasce vazio em vez de pré-preencher "0" (que o dígito seguinte acrescentava).
    .map((s) => ({ type: 'normal', weightKg: num(raw(s).weight_kg) || null, reps: num(raw(s).reps) }));
}

/** Séries válidas (RN-08) do exercício em treinos finalizados: a base para detectar PR (RN-11). */
export async function validSetHistory(
  db: Database,
  exerciseId: string,
  excludeWorkoutId?: string,
  /** Só treinos iniciados antes deste instante (ao ver um treino antigo, os mais novos não contam). */
  beforeStartedAt = Infinity,
): Promise<SetLog[]> {
  const logs = await db.get<Model>('workout_exercise').query(Q.where('exercise_id', exerciseId), active).fetch();
  if (logs.length === 0) return [];
  const finished = await db
    .get<Model>('workout')
    .query(Q.where('id', Q.oneOf(logs.map((l) => String(raw(l).workout_id)))), Q.where('status', 'finished'), active)
    .fetch();
  const ok = new Set(finished.filter((w) => w.id !== excludeWorkoutId && Number(raw(w).started_at) < beforeStartedAt).map((w) => w.id));
  const sets = await children(db, 'workout_set', 'workout_exercise_id', logs.filter((l) => ok.has(String(raw(l).workout_id))).map((l) => l.id));
  return sets
    .map((s) => ({ type: String(raw(s).set_type) as SetType, weightKg: num(raw(s).weight_kg), reps: num(raw(s).reps), completedAt: num(raw(s).completed_at) }))
    .filter(isValidSet);
}

function prepareExercise(
  db: Database,
  workoutId: string,
  sortOrder: number,
  exerciseId: string,
  restSeconds: number,
  sets: PlannedSet[],
  now: number,
): Model[] {
  const exercise = prepareCreate(
    db,
    'workout_exercise',
    { workout_id: workoutId, exercise_id: exerciseId, sort_order: sortOrder, superset_group: null, rest_seconds: restSeconds, notes: null },
    now,
  );
  const rows = sets.map((s, i) =>
    prepareCreate(
      db,
      'workout_set',
      {
        workout_exercise_id: exercise.id,
        sort_order: i,
        set_type: s.type,
        weight_kg: s.weightKg === null ? null : roundKg(s.weightKg),
        reps: s.reps,
        completed_at: null,
      },
      now,
    ),
  );
  return [exercise, ...rows];
}

/** Cria o treino ativo, da rotina (séries pendentes com a sessão anterior ou o alvo) ou livre. */
export async function startWorkout(
  db: Database,
  opts: { routineId?: string; name?: string; now?: number; tzOffsetMin?: number } = {},
): Promise<string> {
  const now = opts.now ?? Date.now();
  return db.write(async () => {
    const current = await findActive(db);
    if (current) throw new ActiveWorkoutError(current.id);

    let name = opts.name ?? '';
    const planned: { exerciseId: string; rest: number; sets: PlannedSet[] }[] = [];
    if (opts.routineId) {
      const routine = await db.get<Model>('routine').find(opts.routineId);
      name = opts.name ?? String(raw(routine).name);
      const exercises = await children(db, 'routine_exercise', 'routine_id', [routine.id]);
      const sets = await children(db, 'routine_set', 'routine_exercise_id', exercises.map((e) => e.id));
      for (const re of exercises) {
        const exerciseId = String(raw(re).exercise_id);
        const previous = await lastSessionSets(db, exerciseId);
        planned.push({
          exerciseId,
          rest: num(raw(re).rest_seconds) ?? DEFAULT_REST_S,
          sets: sets
            .filter((s) => raw(s).routine_exercise_id === re.id)
            .map((s, i) => ({
              type: String(raw(s).set_type) as SetType,
              weightKg: previous[i]?.weightKg ?? num(raw(s).target_weight_kg),
              reps: previous[i]?.reps ?? num(raw(s).reps_max) ?? num(raw(s).reps_min),
            })),
        });
      }
    }

    const workout = prepareCreate(
      db,
      'workout',
      {
        routine_id: opts.routineId ?? null,
        name,
        started_at: now,
        ended_at: null,
        tz_offset_min: opts.tzOffsetMin ?? -new Date(now).getTimezoneOffset(),
        status: 'active',
        notes: null,
      },
      now,
    );
    const ops = [workout, ...planned.flatMap((p, i) => prepareExercise(db, workout.id, i, p.exerciseId, p.rest, p.sets, now))];
    await db.batch(ops);
    return workout.id;
  });
}

export async function loadWorkout(db: Database, id: string): Promise<WorkoutSnapshot> {
  const w = raw(await db.get<Model>('workout').find(id));
  const exercises = await children(db, 'workout_exercise', 'workout_id', [id]);
  const sets = await children(db, 'workout_set', 'workout_exercise_id', exercises.map((e) => e.id));
  const ids = [...new Set(exercises.map((e) => String(raw(e).exercise_id)))];
  const catalog = ids.length ? await db.get<Model>('exercise').query(Q.where('id', Q.oneOf(ids))).fetch() : [];
  const nameOf = new Map(catalog.map((e) => [e.id, String(raw(e).name)]));

  return {
    id,
    name: String(w.name),
    routineId: (w.routine_id as string | null) ?? null,
    status: w.status as 'active' | 'finished',
    startedAt: Number(w.started_at),
    endedAt: num(w.ended_at),
    tzOffsetMin: Number(w.tz_offset_min),
    notes: (w.notes as string | null) ?? null,
    exercises: exercises.map((e) => ({
      id: e.id,
      exerciseId: String(raw(e).exercise_id),
      name: nameOf.get(String(raw(e).exercise_id)) ?? '',
      restSeconds: num(raw(e).rest_seconds) ?? DEFAULT_REST_S,
      sets: sets
        .filter((s) => raw(s).workout_exercise_id === e.id)
        .map((s) => ({
          id: s.id,
          type: String(raw(s).set_type) as SetType,
          weightKg: num(raw(s).weight_kg),
          reps: num(raw(s).reps),
          completedAt: num(raw(s).completed_at),
        })),
    })),
  };
}

/** O treino ativo do aparelho (inclusive após crash ou reinício), ou null. */
export async function getActiveWorkout(db: Database): Promise<ActiveWorkout | null> {
  const row = await findActive(db);
  if (!row) return null;
  const exercises = await children(db, 'workout_exercise', 'workout_id', [row.id]);
  const sets = await children(db, 'workout_set', 'workout_exercise_id', exercises.map((e) => e.id));
  const done = sets.map((s) => num(raw(s).completed_at)).filter((t): t is number => t !== null);
  const startedAt = Number(raw(row).started_at);
  return {
    id: row.id,
    name: String(raw(row).name),
    routineId: (raw(row).routine_id as string | null) ?? null,
    startedAt,
    lastActivityAt: Math.max(startedAt, ...done),
  };
}

export interface SetPatch {
  weightKg?: number | null;
  reps?: number | null;
  type?: SetType;
  completed?: boolean;
}

/** Edita e/ou conclui uma série. Concluir exige reps inteiras > 0. Grava antes de a UI confirmar (RNF-02). */
export async function updateSet(db: Database, setId: string, patch: SetPatch, now = Date.now()): Promise<void> {
  if (patch.weightKg != null && !(Number.isFinite(patch.weightKg) && patch.weightKg >= 0)) throw new Error('carga inválida');
  if (patch.reps != null && !(Number.isInteger(patch.reps) && patch.reps > 0)) throw new Error('repetições inválidas');

  await db.write(async () => {
    const set = await db.get<Model>('workout_set').find(setId);
    const fields: Raw = { updated_at: now };
    if (patch.weightKg !== undefined) fields.weight_kg = patch.weightKg === null ? null : roundKg(patch.weightKg);
    if (patch.reps !== undefined) fields.reps = patch.reps;
    if (patch.type !== undefined) fields.set_type = patch.type;
    if (patch.completed !== undefined) {
      const reps = patch.reps !== undefined ? patch.reps : num(raw(set).reps);
      if (patch.completed && !reps) throw new Error('repetições inválidas');
      fields.completed_at = patch.completed ? now : null;
    }
    await set.update(() => setFields(set, fields));
  });
}

/** Nova série copiando carga e reps da última (tipo normal). */
export async function addSet(db: Database, workoutExerciseId: string, now = Date.now()): Promise<string> {
  return db.write(async () => {
    const sets = await children(db, 'workout_set', 'workout_exercise_id', [workoutExerciseId]);
    const last = sets[sets.length - 1];
    const created = prepareCreate(
      db,
      'workout_set',
      {
        workout_exercise_id: workoutExerciseId,
        sort_order: last ? Number(raw(last).sort_order) + 1 : 0,
        set_type: 'normal',
        weight_kg: last ? num(raw(last).weight_kg) : null,
        reps: last ? num(raw(last).reps) : null,
        completed_at: null,
      },
      now,
    );
    await db.batch([created]);
    return created.id;
  });
}

/** Acrescenta um exercício do catálogo ao treino ativo, com 1 série (sessão anterior a lápis). */
export async function addExercise(db: Database, workoutId: string, exerciseId: string, now = Date.now()): Promise<string> {
  return db.write(async () => {
    await db.get<Model>('workout').find(workoutId); // falha se não existir (vale também para treino finalizado: edição de histórico)
    await db.get<Model>('exercise').find(exerciseId); // falha se não existir no catálogo
    const existing = await children(db, 'workout_exercise', 'workout_id', [workoutId]);
    const previous = (await lastSessionSets(db, exerciseId))[0];
    const ops = prepareExercise(
      db,
      workoutId,
      existing.length ? Number(raw(existing[existing.length - 1]).sort_order) + 1 : 0,
      exerciseId,
      DEFAULT_REST_S,
      [{ type: 'normal', weightKg: previous?.weightKg ?? null, reps: previous?.reps ?? null }],
      now,
    );
    await db.batch(ops);
    return ops[0].id;
  });
}

/**
 * C16: troca o exercício. As séries concluídas ficam no exercício antigo; as pendentes (com carga/reps alvo)
 * passam para uma linha nova do exercício escolhido, logo depois do antigo. Sem concluídas, o antigo vira tombstone.
 * Uma única transação (RNF-02). Devolve o id da nova linha de `workout_exercise`.
 */
export async function swapExercise(
  db: Database,
  workoutExerciseId: string,
  newExerciseId: string,
  now = Date.now(),
): Promise<string> {
  return db.write(async () => {
    const old = await db.get<Model>('workout_exercise').find(workoutExerciseId);
    await db.get<Model>('exercise').find(newExerciseId); // falha se não existir no catálogo
    const workoutId = String(raw(old).workout_id);
    if (String(raw(old).exercise_id) === newExerciseId) throw new Error('já é este exercício');
    if (raw(await db.get<Model>('workout').find(workoutId)).status !== 'active') throw new Error('só o treino ativo troca de exercício');
    // As pendentes passam a valer para o NOVO exercício: sessão anterior dele (por posição; além do que existiu, a última),
    // nunca a carga e as reps do exercício antigo. Sem sessão anterior, ficam vazias.
    const previous = await lastSessionSets(db, newExerciseId);
    const siblings = await children(db, 'workout_exercise', 'workout_id', [workoutId]);
    const sets = await children(db, 'workout_set', 'workout_exercise_id', [workoutExerciseId]);
    const pending = sets.filter((s) => raw(s).completed_at === null);
    const oldOrder = Number(raw(old).sort_order);
    const created = prepareCreate(
      db,
      'workout_exercise',
      {
        workout_id: workoutId,
        exercise_id: newExerciseId,
        sort_order: oldOrder + 1,
        superset_group: null,
        rest_seconds: num(raw(old).rest_seconds) ?? DEFAULT_REST_S,
        notes: null,
      },
      now,
    );
    const ops: Model[] = [created];
    // abre espaço logo depois do antigo
    siblings
      .filter((e) => e.id !== old.id && Number(raw(e).sort_order) > oldOrder)
      .forEach((e) => ops.push(e.prepareUpdate(() => setFields(e, { sort_order: Number(raw(e).sort_order) + 1, updated_at: now }))));
    pending.forEach((s, i) => {
      const seed = previous.length ? previous[Math.min(i, previous.length - 1)] : null;
      ops.push(
        s.prepareUpdate(() =>
          setFields(s, {
            workout_exercise_id: created.id,
            weight_kg: seed?.weightKg == null ? null : roundKg(seed.weightKg),
            reps: seed?.reps ?? null,
            updated_at: now,
          }),
        ),
      );
    });
    if (pending.length === sets.length) {
      ops.push(old.prepareUpdate(() => setFields(old, { deleted_at: now, updated_at: now })));
    }
    await db.batch(ops);
    return created.id;
  });
}

/** Tombstone do exercício e de suas séries. */
export async function removeExercise(db: Database, workoutExerciseId: string, now = Date.now()): Promise<void> {
  await db.write(async () => {
    const exercise = await db.get<Model>('workout_exercise').find(workoutExerciseId);
    const sets = await children(db, 'workout_set', 'workout_exercise_id', [workoutExerciseId]);
    await db.batch([exercise, ...sets].map((r) => r.prepareUpdate(() => setFields(r, { deleted_at: now, updated_at: now }))));
  });
}

/**
 * Finaliza o treino ativo numa transação. `ended_at` é a última série concluída (RN-03).
 * Sem séries concluídas: NothingToSaveError (RN-05). Com pendentes e sem `pending`: PendingSetsError (RN-06).
 */
export async function finishWorkout(
  db: Database,
  id: string,
  opts: { pending?: 'complete' | 'discard'; now?: number } = {},
): Promise<void> {
  const now = opts.now ?? Date.now();
  await db.write(async () => {
    const workout = await db.get<Model>('workout').find(id);
    if (raw(workout).status !== 'active') throw new Error('o treino já foi finalizado');
    const exercises = await children(db, 'workout_exercise', 'workout_id', [id]);
    const sets = await children(db, 'workout_set', 'workout_exercise_id', exercises.map((e) => e.id));

    const logs: ExerciseLog[] = exercises.map((e) => ({
      exerciseId: String(raw(e).exercise_id),
      sets: sets
        .filter((s) => raw(s).workout_exercise_id === e.id)
        .map((s) => ({
          type: String(raw(s).set_type) as SetType,
          weightKg: num(raw(s).weight_kg),
          reps: num(raw(s).reps),
          completedAt: num(raw(s).completed_at),
        })),
    }));
    const decision = finishDecision(logs);
    if (decision === 'discard_only') throw new NothingToSaveError();
    if (decision === 'ask_pending' && !opts.pending) throw new PendingSetsError();

    const ops: Model[] = [];
    const snapshots: [Model, Model['_raw']][] = [];
    const update = (record: Model, fields: Raw) => {
      snapshots.push([record, { ...record._raw }]);
      ops.push(record.prepareUpdate(() => setFields(record, { ...fields, updated_at: now })));
    };

    const pending = sets.filter((s) => raw(s).completed_at === null);
    const kept = new Set(sets.map((s) => s.id));
    // 'complete': conclui a pendente com reps > 0 (mesma regra do updateSet); a sem reps não pode ficar concluída
    // nem pendente num treino finalizado: vira tombstone. 'discard': todas as pendentes viram tombstone.
    const toComplete = opts.pending === 'complete' ? pending.filter((s) => (num(raw(s).reps) ?? 0) > 0) : [];
    const toTomb = opts.pending === 'discard' ? pending : opts.pending === 'complete' ? pending.filter((s) => !toComplete.includes(s)) : [];
    toComplete.forEach((s) => update(s, { completed_at: now }));
    toTomb.forEach((s) => {
      kept.delete(s.id);
      update(s, { deleted_at: now });
    });
    if (toTomb.length > 0) {
      exercises
        .filter((e) => !sets.some((s) => kept.has(s.id) && raw(s).workout_exercise_id === e.id))
        .forEach((e) => update(e, { deleted_at: now }));
    }

    // RN-03: `ended_at` é a última série REALMENTE concluída (inclusive as concluídas agora).
    const completed = [
      ...sets.filter((s) => kept.has(s.id) && raw(s).completed_at !== null).map((s) => Number(raw(s).completed_at)),
      ...toComplete.map(() => now),
    ];
    update(workout, { status: 'finished', ended_at: Math.max(...completed) });
    await applyBatch(db, ops, snapshots);
  });
}

/** Exclusão lógica do treino e dos filhos (descartar o ativo, RN-05, ou excluir do histórico, RN-20). */
export async function discardWorkout(db: Database, id: string, now = Date.now()): Promise<void> {
  await db.write(async () => {
    const workout = await db.get<Model>('workout').find(id);
    const exercises = await children(db, 'workout_exercise', 'workout_id', [id]);
    const sets = await children(db, 'workout_set', 'workout_exercise_id', exercises.map((e) => e.id));
    await db.batch([workout, ...exercises, ...sets].map((r) => r.prepareUpdate(() => setFields(r, { deleted_at: now, updated_at: now }))));
  });
}

/** Novo treino ativo com os mesmos exercícios e valores de um treino antigo (tudo pendente). */
export async function repeatWorkout(db: Database, sourceId: string, now = Date.now()): Promise<string> {
  return db.write(async () => {
    const current = await findActive(db);
    if (current) throw new ActiveWorkoutError(current.id);
    const source = await db.get<Model>('workout').find(sourceId);
    const exercises = await children(db, 'workout_exercise', 'workout_id', [sourceId]);
    const sets = await children(db, 'workout_set', 'workout_exercise_id', exercises.map((e) => e.id));

    const workout = prepareCreate(
      db,
      'workout',
      {
        routine_id: (raw(source).routine_id as string | null) ?? null,
        name: String(raw(source).name),
        started_at: now,
        ended_at: null,
        tz_offset_min: -new Date(now).getTimezoneOffset(),
        status: 'active',
        notes: null,
      },
      now,
    );
    const ops = [
      workout,
      ...exercises.flatMap((e, i) =>
        prepareExercise(
          db,
          workout.id,
          i,
          String(raw(e).exercise_id),
          num(raw(e).rest_seconds) ?? DEFAULT_REST_S,
          sets
            .filter((s) => raw(s).workout_exercise_id === e.id)
            .map((s) => ({ type: String(raw(s).set_type) as SetType, weightKg: num(raw(s).weight_kg), reps: num(raw(s).reps) })),
          now,
        ),
      ),
    ];
    await db.batch(ops);
    return workout.id;
  });
}

/** Registra um treino que já aconteceu (finalizado e vazio; as séries entram depois pela edição). RN-07: sem data futura. */
export async function createRetroactiveWorkout(
  db: Database,
  opts: { startedAt: number; name?: string; now?: number; tzOffsetMin?: number },
): Promise<string> {
  const now = opts.now ?? Date.now();
  if (validateRetroactive(opts.startedAt, now) === 'future') throw new RetroactiveError();
  return db.write(async () => {
    const workout = prepareCreate(
      db,
      'workout',
      {
        routine_id: null,
        name: opts.name ?? '',
        started_at: opts.startedAt,
        ended_at: opts.startedAt,
        tz_offset_min: opts.tzOffsetMin ?? -new Date(opts.startedAt).getTimezoneOffset(),
        status: 'finished',
        notes: null,
      },
      now,
    );
    await db.batch([workout]);
    return workout.id;
  });
}

/** Tombstone de uma série (edição do histórico). */
export async function removeSet(db: Database, setId: string, now = Date.now()): Promise<void> {
  await db.write(async () => {
    const set = await db.get<Model>('workout_set').find(setId);
    await set.update(() => setFields(set, { deleted_at: now, updated_at: now }));
  });
}

/** Depois de editar séries, `ended_at` volta a ser a última série concluída (RN-03). Sem série concluída, mantém. */
export async function syncWorkoutEnd(db: Database, workoutId: string, now = Date.now()): Promise<void> {
  await db.write(async () => {
    const workout = await db.get<Model>('workout').find(workoutId);
    const exercises = await children(db, 'workout_exercise', 'workout_id', [workoutId]);
    const sets = await children(db, 'workout_set', 'workout_exercise_id', exercises.map((e) => e.id));
    const done = sets.map((s) => num(raw(s).completed_at)).filter((t): t is number => t !== null);
    if (done.length === 0) return;
    await workout.update(() => setFields(workout, { ended_at: Math.max(...done), updated_at: now }));
  });
}

/** Há treino finalizado cujo intervalo se sobrepõe a [start, end]? Só aviso, nunca bloqueio (RN-07). */
export async function hasOverlap(db: Database, start: number, end: number, excludeWorkoutId?: string): Promise<boolean> {
  const rows = await db.get<Model>('workout').query(Q.where('status', 'finished'), active).fetch();
  return rows.some(
    (w) =>
      w.id !== excludeWorkoutId &&
      overlaps({ start, end }, { start: Number(raw(w).started_at), end: Number(raw(w).ended_at ?? raw(w).started_at) }),
  );
}
