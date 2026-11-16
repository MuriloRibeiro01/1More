import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Database, Model } from '@nozbe/watermelondb';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import {
  RetroactiveError,
  addExercise,
  addSet,
  createRetroactiveWorkout,
  finishWorkout,
  hasOverlap,
  loadWorkout,
  removeSet,
  startWorkout,
  syncWorkoutEnd,
  updateSet,
} from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';

// Fase 7 — editar treino passado e registrar treino retroativo (RN-07, RN-11, RN-20).
const NOW = Date.UTC(2026, 10, 12, 18, 0, 0);
const DIA = 86_400_000;
const min = (n: number) => n * 60_000;

let db: Database;
let supino: string;
let rotinaId: string;
const linhas = async (t: string) => (await db.get<Model>(t).query().fetch()).map((m) => m._raw as unknown as Record<string, unknown>);

beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  supino = (await listCatalog(db)).find((e) => e.name === 'Supino reto com barra')!.id;
  rotinaId = await saveRoutine(db, {
    name: 'A',
    exercises: [{ exerciseId: supino, sets: 2, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 }],
  });
});

describe('createRetroactiveWorkout (RN-07)', () => {
  it('cria treino finalizado vazio na data pedida, com fuso e colunas de sync', async () => {
    const id = await createRetroactiveWorkout(db, { startedAt: NOW - 2 * DIA, name: 'Treino A', now: NOW, tzOffsetMin: -180 });
    expect(await loadWorkout(db, id)).toMatchObject({
      status: 'finished', name: 'Treino A', startedAt: NOW - 2 * DIA, endedAt: NOW - 2 * DIA, tzOffsetMin: -180, exercises: [],
    });
    const [linha] = (await linhas('workout')).filter((r) => r.id === id);
    expect(linha).toMatchObject({ user_id: null, deleted_at: null, created_at: NOW });
  });

  it('data futura é recusada e nada é gravado', async () => {
    await expect(createRetroactiveWorkout(db, { startedAt: NOW + 1, now: NOW })).rejects.toBeInstanceOf(RetroactiveError);
    expect(await linhas('workout')).toHaveLength(0);
  });

  it('não ocupa a vaga do treino ativo (RN-02)', async () => {
    await startWorkout(db, { name: 'agora', now: NOW });
    await expect(createRetroactiveWorkout(db, { startedAt: NOW - DIA, now: NOW })).resolves.toEqual(expect.any(String));
  });
});

describe('editar um treino finalizado', () => {
  async function passado() {
    const id = await startWorkout(db, { routineId: rotinaId, now: NOW - 3 * DIA });
    const w = await loadWorkout(db, id);
    await updateSet(db, w.exercises[0].sets[0].id, { weightKg: 60, reps: 10, completed: true }, NOW - 3 * DIA + min(10));
    await finishWorkout(db, id, { pending: 'discard', now: NOW - 3 * DIA + min(40) });
    return id;
  }

  it('adicionar exercício e série num treino finalizado funciona', async () => {
    const id = await createRetroactiveWorkout(db, { startedAt: NOW - DIA, name: 'x', now: NOW });
    await addExercise(db, id, supino, NOW);
    const w = await loadWorkout(db, id);
    expect(w.exercises).toHaveLength(1);
    await addSet(db, w.exercises[0].id, NOW);
    expect((await loadWorkout(db, id)).exercises[0].sets).toHaveLength(2);
  });

  it('syncWorkoutEnd leva ended_at para a última série concluída', async () => {
    const id = await passado();
    const w = await loadWorkout(db, id);
    expect(w.endedAt).toBe(NOW - 3 * DIA + min(10));
    await addSet(db, w.exercises[0].id, NOW);
    const novo = (await loadWorkout(db, id)).exercises[0].sets[1];
    await updateSet(db, novo.id, { weightKg: 62.5, reps: 8, completed: true }, NOW - 3 * DIA + min(25));
    await syncWorkoutEnd(db, id, NOW);
    expect((await loadWorkout(db, id)).endedAt).toBe(NOW - 3 * DIA + min(25));
  });

  it('syncWorkoutEnd sem série concluída mantém o ended_at', async () => {
    const id = await createRetroactiveWorkout(db, { startedAt: NOW - DIA, now: NOW });
    await syncWorkoutEnd(db, id, NOW);
    expect((await loadWorkout(db, id)).endedAt).toBe(NOW - DIA);
  });

  it('removeSet faz tombstone (RN-20) e a série some do treino', async () => {
    const id = await passado();
    const w = await loadWorkout(db, id);
    await removeSet(db, w.exercises[0].sets[0].id, NOW);
    expect((await loadWorkout(db, id)).exercises[0]?.sets ?? []).toHaveLength(0);
    expect((await linhas('workout_set')).filter((r) => r.deleted_at != null).length).toBeGreaterThanOrEqual(1);
  });
});

describe('hasOverlap (RN-07: só aviso)', () => {
  it('detecta sobreposição com treino finalizado, ignora o próprio e os excluídos', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: NOW - 3 * DIA });
    const w = await loadWorkout(db, id);
    await updateSet(db, w.exercises[0].sets[0].id, { weightKg: 60, reps: 10, completed: true }, NOW - 3 * DIA + min(30));
    await finishWorkout(db, id, { pending: 'discard', now: NOW - 3 * DIA + min(40) });

    const inicio = NOW - 3 * DIA;
    expect(await hasOverlap(db, inicio + min(10), inicio + min(50))).toBe(true);
    expect(await hasOverlap(db, inicio + min(31), inicio + min(90))).toBe(false); // encostar/depois não conta
    expect(await hasOverlap(db, inicio + min(10), inicio + min(50), id)).toBe(false);
  });
});
