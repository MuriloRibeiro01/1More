import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Database } from '@nozbe/watermelondb';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { discardWorkout, finishWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { exerciseSessions, trainedExercises } from '../../src/workout/sessions';
import { criarBancoDeTeste } from '../../test-utils/db';

// Fase 8 — base de dados do Progresso e do Exercício: sessões (treinos finalizados) com as séries válidas.
const D = 86_400_000;
const T0 = Date.UTC(2026, 10, 1, 10, 0, 0);
const min = (n: number) => n * 60_000;

let db: Database;
let supino: string;
let agachamento: string;
let rotinaId: string;

beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const cat = await listCatalog(db);
  supino = cat.find((e) => e.name === 'Supino reto com barra')!.id;
  agachamento = cat.find((e) => e.name === 'Agachamento livre')!.id;
  rotinaId = await saveRoutine(db, {
    name: 'A',
    exercises: [
      { exerciseId: supino, sets: 3, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 },
      { exerciseId: agachamento, sets: 1, weightKg: 100, repsMin: null, repsMax: 5, restSeconds: 120 },
    ],
  });
});

async function treino(inicio: number, series: { w: number; r: number; type?: 'warmup' | 'normal' }[], tz = 0) {
  const id = await startWorkout(db, { routineId: rotinaId, now: inicio, tzOffsetMin: tz });
  const w = await loadWorkout(db, id);
  for (let i = 0; i < series.length; i++) {
    await updateSet(db, w.exercises[0].sets[i].id, { weightKg: series[i].w, reps: series[i].r, type: series[i].type ?? 'normal', completed: true }, inicio + min(i + 1));
  }
  await finishWorkout(db, id, { pending: 'discard', now: inicio + min(30) });
  return id;
}

describe('exerciseSessions', () => {
  it('sem treinos devolve vazio', async () => {
    expect(await exerciseSessions(db, supino)).toEqual([]);
  });

  it('uma sessão por treino finalizado, da mais antiga à mais nova, só com séries válidas', async () => {
    await treino(T0 + 7 * D, [{ w: 62.5, r: 10 }]);
    await treino(T0, [{ w: 40, r: 12, type: 'warmup' }, { w: 60, r: 10 }, { w: 60, r: 9 }]);
    const s = await exerciseSessions(db, supino);
    expect(s.map((x) => x.startedAt)).toEqual([T0, T0 + 7 * D]);
    expect(s[0].sets.map((x) => [x.weightKg, x.reps])).toEqual([[60, 10], [60, 9]]);
    expect(s[0]).toMatchObject({ tzOffsetMin: 0, workoutId: expect.any(String) });
  });

  it('ignora treino ativo, excluído e outro exercício', async () => {
    const id = await treino(T0, [{ w: 60, r: 10 }]);
    const ativo = await startWorkout(db, { routineId: rotinaId, now: T0 + D });
    await discardWorkout(db, id);
    expect(await exerciseSessions(db, supino)).toEqual([]);
    await discardWorkout(db, ativo);
    await treino(T0 + 2 * D, [{ w: 60, r: 10 }]);
    expect(await exerciseSessions(db, agachamento)).toEqual([]);
  });
});

describe('trainedExercises', () => {
  it('lista os exercícios com séries válidas, o mais recente primeiro, com nome e quantidade de sessões', async () => {
    await treino(T0, [{ w: 60, r: 10 }]);
    await treino(T0 + D, [{ w: 62.5, r: 10 }]);
    const lista = await trainedExercises(db);
    expect(lista).toEqual([expect.objectContaining({ exerciseId: supino, name: 'Supino reto com barra', sessions: 2, lastAt: T0 + D + min(1) })]);
  });

  it('vazio sem treinos', async () => {
    expect(await trainedExercises(db)).toEqual([]);
  });
});
