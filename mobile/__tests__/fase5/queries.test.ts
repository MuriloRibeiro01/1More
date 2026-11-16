import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Database } from '@nozbe/watermelondb';
import { deleteRoutine, listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { addExercise, discardWorkout, finishWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { finishedWorkoutStarts, listRoutinesWithLastDone } from '../../src/workout/queries';
import { criarBancoDeTeste } from '../../test-utils/db';

const T0 = Date.UTC(2026, 10, 9, 10, 0, 0); // segunda
const DIA = 86_400_000;

let db: Database;
let supino: string;
let rotA: string;
let rotB: string;

/** Treino finalizado com 1 série, para a rotina (ou livre). */
async function treinoFeito(routineId: string | undefined, start: number, tzOffsetMin = 0) {
  const id = await startWorkout(db, { routineId, name: 'livre', now: start, tzOffsetMin });
  if (!routineId) await addExercise(db, id, supino, start + 1);
  const set = (await loadWorkout(db, id)).exercises[0].sets[0].id;
  await updateSet(db, set, { weightKg: 50, reps: 5, completed: true }, start + 1000);
  await finishWorkout(db, id, { now: start + 2000 });
  return id;
}

beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  supino = (await listCatalog(db)).find((e) => e.name === 'Supino reto com barra')!.id;
  const ex = { exerciseId: supino, sets: 1, weightKg: null, repsMin: null, repsMax: null, restSeconds: 90 };
  rotA = await saveRoutine(db, { name: 'Treino A', exercises: [ex] });
  rotB = await saveRoutine(db, { name: 'Treino B', exercises: [ex] });
});

describe('listRoutinesWithLastDone', () => {
  it('rotina nunca feita tem lastDoneAt nulo; traz nome, ordem de criação e exercícios', async () => {
    const r = await listRoutinesWithLastDone(db);
    expect(r.map((x) => [x.id, x.name, x.order, x.lastDoneAt])).toEqual([
      [rotA, 'Treino A', 0, null],
      [rotB, 'Treino B', 1, null],
    ]);
    expect(r[0].exerciseNames).toEqual(['Supino reto com barra']);
  });

  it('lastDoneAt é o início do treino FINALIZADO mais recente da rotina', async () => {
    await treinoFeito(rotA, T0);
    await treinoFeito(rotA, T0 + 2 * DIA);
    const r = await listRoutinesWithLastDone(db);
    expect(r.find((x) => x.id === rotA)!.lastDoneAt).toBe(T0 + 2 * DIA);
    expect(r.find((x) => x.id === rotB)!.lastDoneAt).toBeNull();
  });

  it('treino ativo e treino excluído não contam como feito', async () => {
    const feito = await treinoFeito(rotA, T0);
    await discardWorkout(db, feito, T0 + 10_000);
    await startWorkout(db, { routineId: rotB, now: T0 + DIA });
    const r = await listRoutinesWithLastDone(db);
    expect(r.map((x) => x.lastDoneAt)).toEqual([null, null]);
  });

  it('rotina excluída some', async () => {
    await deleteRoutine(db, rotA);
    expect((await listRoutinesWithLastDone(db)).map((x) => x.id)).toEqual([rotB]);
  });
});

describe('finishedWorkoutStarts', () => {
  it('só treinos finalizados dentro do intervalo [de, até), com o fuso de cada um', async () => {
    await treinoFeito(rotA, T0, -180); // dentro
    await treinoFeito(undefined, T0 + DIA, 0); // dentro, livre
    await treinoFeito(rotB, T0 - 3 * DIA); // antes
    await treinoFeito(rotB, T0 + 7 * DIA); // depois (limite superior excluído)
    const r = await finishedWorkoutStarts(db, T0 - DIA, T0 + 7 * DIA);
    expect(r).toEqual([
      { startedAt: T0, tzOffsetMin: -180 },
      { startedAt: T0 + DIA, tzOffsetMin: 0 },
    ]);
  });

  it('ignora treino ativo', async () => {
    await startWorkout(db, { routineId: rotA, now: T0 });
    expect(await finishedWorkoutStarts(db, T0 - DIA, T0 + DIA)).toEqual([]);
  });
});
