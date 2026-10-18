import { Q, type Database, type Model } from '@nozbe/watermelondb';
import { uuidv7 } from '../db/uuid';
import { CATALOG_SEED } from './catalog';
import { DEFAULT_REST_S, roundKg, validateRoutine } from './rules';
import type { CatalogExercise, ExerciseDraft, RoutineDraft, RoutineError, RoutineSummary } from './types';

// Persistência da planilha (T-005). Recebe o Database por parâmetro (app: src/db; testes: LokiJS).
// Exclusão sempre lógica (deleted_at), nunca markAsDeleted/destroy: o tombstone é o que o sync vai enviar.

export class RoutineValidationError extends Error {
  constructor(public readonly errors: RoutineError[]) {
    super(`rotina inválida: ${errors.join(', ')}`);
    this.name = 'RoutineValidationError';
  }
}

type Raw = Record<string, string | number | null>;
const raw = (m: Model) => m._raw as unknown as Raw;
const active = Q.where('deleted_at', null);
const bySortOrder = (a: Model, b: Model) => Number(raw(a).sort_order) - Number(raw(b).sort_order);

function setFields(record: Model, fields: Raw) {
  for (const [column, value] of Object.entries(fields)) record._setRaw(column, value);
}

/** Prepara a criação de uma linha sincronizável com id UUID v7 e carimbos do app. */
function prepareCreate(db: Database, table: string, fields: Raw, now: number): Model {
  return db.get<Model>(table).prepareCreate((record) => {
    record._raw.id = uuidv7(now);
    setFields(record, { ...fields, user_id: null, created_at: now, updated_at: now, deleted_at: null });
  });
}

/** Semeia o catálogo embarcado; idempotente (só cria o que falta, pelo nome). */
export async function seedCatalog(db: Database): Promise<void> {
  await db.write(async () => {
    const existing = await db.get<Model>('exercise').query(Q.where('user_id', null)).fetch();
    const names = new Set(existing.map((e) => String(raw(e).name).toLowerCase()));
    const now = Date.now();
    const missing = CATALOG_SEED.filter((s) => !names.has(s.name.toLowerCase())).map((s) =>
      prepareCreate(
        db,
        'exercise',
        {
          name: s.name,
          tracking_type: s.trackingType,
          primary_muscle: s.primaryMuscle,
          secondary_muscles: JSON.stringify(s.secondaryMuscles),
          equipment_code: s.equipment,
        },
        now,
      ),
    );
    if (missing.length) await db.batch(missing);
  });
}

/** Catálogo ativo, ordenado por nome. */
export async function listCatalog(db: Database): Promise<CatalogExercise[]> {
  const rows = await db.get<Model>('exercise').query(Q.where('user_id', null), active).fetch();
  return rows
    .map((e) => ({ id: e.id, name: String(raw(e).name) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

async function activeChildren(db: Database, table: string, parentColumn: string, parentIds: string[]) {
  if (parentIds.length === 0) return [];
  const rows = await db.get<Model>(table).query(Q.where(parentColumn, Q.oneOf(parentIds)), active).fetch();
  return rows.sort(bySortOrder);
}

function setFieldsFor(ex: ExerciseDraft): Raw {
  return {
    set_type: 'normal',
    reps_min: ex.repsMin,
    reps_max: ex.repsMax,
    target_weight_kg: ex.weightKg === null ? null : roundKg(ex.weightKg),
  };
}

/**
 * Cria ou atualiza numa única transação (um db.batch): ou grava tudo, ou nada (RNF-02).
 * Linhas existentes são reaproveitadas por posição; as que sobram viram tombstone.
 * Devolve o id da rotina.
 */
export async function saveRoutine(db: Database, draft: RoutineDraft): Promise<string> {
  const errors = validateRoutine(draft);
  if (errors.length) throw new RoutineValidationError(errors);

  return db.write(async () => {
    const exerciseIds = [...new Set(draft.exercises.map((e) => e.exerciseId))];
    const found = await db.get<Model>('exercise').query(Q.where('id', Q.oneOf(exerciseIds)), active).fetchCount();
    if (found !== exerciseIds.length) throw new Error('exercício não encontrado no catálogo');

    const now = Date.now();
    const ops: Model[] = [];
    const snapshots: [Model, Model['_raw']][] = [];
    const update = (record: Model, fields: Raw) => {
      snapshots.push([record, { ...record._raw }]);
      ops.push(record.prepareUpdate(() => setFields(record, { ...fields, updated_at: now })));
    };
    const tombstone = (record: Model) => update(record, { deleted_at: now });

    let routineId: string;
    let oldExercises: Model[] = [];
    let oldSets: Model[] = [];
    if (draft.id) {
      const routine = await db.get<Model>('routine').find(draft.id);
      routineId = routine.id;
      update(routine, { name: draft.name.trim() });
      oldExercises = await activeChildren(db, 'routine_exercise', 'routine_id', [routineId]);
      oldSets = await activeChildren(db, 'routine_set', 'routine_exercise_id', oldExercises.map((e) => e.id));
    } else {
      const routine = prepareCreate(db, 'routine', { name: draft.name.trim(), notes: null, sort_order: 0 }, now);
      routineId = routine.id;
      ops.push(routine);
    }

    draft.exercises.forEach((ex, i) => {
      const fields: Raw = { routine_id: routineId, exercise_id: ex.exerciseId, sort_order: i, rest_seconds: ex.restSeconds };
      const old = oldExercises[i];
      let routineExerciseId: string;
      if (old) {
        routineExerciseId = old.id;
        update(old, fields);
      } else {
        const created = prepareCreate(db, 'routine_exercise', { ...fields, notes: null }, now);
        routineExerciseId = created.id;
        ops.push(created);
      }

      const previous = oldSets.filter((s) => raw(s).routine_exercise_id === routineExerciseId);
      for (let j = 0; j < ex.sets; j++) {
        const setFieldsJ: Raw = { ...setFieldsFor(ex), routine_exercise_id: routineExerciseId, sort_order: j };
        if (previous[j]) update(previous[j], setFieldsJ);
        else ops.push(prepareCreate(db, 'routine_set', setFieldsJ, now));
      }
      previous.slice(ex.sets).forEach(tombstone);
    });

    for (const old of oldExercises.slice(draft.exercises.length)) {
      tombstone(old);
      oldSets.filter((s) => raw(s).routine_exercise_id === old.id).forEach(tombstone);
    }

    try {
      await db.batch(ops);
    } catch (error) {
      // O Watermelon já aplicou o prepareUpdate nos objetos em memória: volta ao que está no disco.
      for (const [record, snapshot] of snapshots) {
        record._raw = snapshot;
        record._preparedState = null;
      }
      throw error;
    }
    return routineId;
  });
}

export async function loadRoutine(db: Database, id: string): Promise<RoutineDraft> {
  const routine = await db.get<Model>('routine').find(id);
  const exercises = await activeChildren(db, 'routine_exercise', 'routine_id', [id]);
  const sets = await activeChildren(db, 'routine_set', 'routine_exercise_id', exercises.map((e) => e.id));

  return {
    id: routine.id,
    name: String(raw(routine).name),
    exercises: exercises.map((re) => {
      const own = sets.filter((s) => raw(s).routine_exercise_id === re.id);
      const first = own[0] ? raw(own[0]) : {};
      const r = raw(re);
      return {
        exerciseId: String(r.exercise_id),
        sets: own.length,
        weightKg: (first.target_weight_kg as number | null | undefined) ?? null,
        repsMin: (first.reps_min as number | null | undefined) ?? null,
        repsMax: (first.reps_max as number | null | undefined) ?? null,
        restSeconds: (r.rest_seconds as number | null) ?? DEFAULT_REST_S,
      };
    }),
  };
}

/** Rotinas não excluídas, da mais antiga para a mais nova. */
export async function listRoutines(db: Database): Promise<RoutineSummary[]> {
  const routines = (await db.get<Model>('routine').query(active).fetch()).sort(
    (a, b) => Number(raw(a).created_at) - Number(raw(b).created_at) || a.id.localeCompare(b.id),
  );
  const exercises = await activeChildren(db, 'routine_exercise', 'routine_id', routines.map((r) => r.id));
  const ids = [...new Set(exercises.map((e) => String(raw(e).exercise_id)))];
  const catalog = ids.length ? await db.get<Model>('exercise').query(Q.where('id', Q.oneOf(ids))).fetch() : [];
  const nameOf = new Map(catalog.map((e) => [e.id, String(raw(e).name)]));

  return routines.map((r) => ({
    id: r.id,
    name: String(raw(r).name),
    exerciseNames: exercises
      .filter((e) => raw(e).routine_id === r.id)
      .map((e) => nameOf.get(String(raw(e).exercise_id)) ?? ''),
  }));
}

/** Exclusão lógica (deleted_at) da rotina e dos filhos, numa transação. */
export async function deleteRoutine(db: Database, id: string): Promise<void> {
  await db.write(async () => {
    const routine = await db.get<Model>('routine').find(id);
    const exercises = await activeChildren(db, 'routine_exercise', 'routine_id', [id]);
    const sets = await activeChildren(db, 'routine_set', 'routine_exercise_id', exercises.map((e) => e.id));
    const now = Date.now();
    await db.batch(
      [routine, ...exercises, ...sets].map((record) =>
        record.prepareUpdate(() => setFields(record, { deleted_at: now, updated_at: now })),
      ),
    );
  });
}
