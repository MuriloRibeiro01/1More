import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Database } from '@nozbe/watermelondb';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { finishWorkout, loadWorkout, startWorkout, updateSet, validSetHistory } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';

// Base do carimbo PR: séries válidas (concluídas, não aquecimento) de treinos finalizados do mesmo exercício.
const T0 = Date.UTC(2026, 10, 12, 10, 0, 0);
let db: Database;
let supino: string;
let rotinaId: string;

beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  supino = (await listCatalog(db)).find((e) => e.name === 'Supino reto com barra')!.id;
  rotinaId = await saveRoutine(db, {
    name: 'A',
    exercises: [{ exerciseId: supino, sets: 3, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 }],
  });
});

async function treino(inicio: number, series: { w: number; r: number; type?: 'warmup' | 'normal' }[]) {
  const id = await startWorkout(db, { routineId: rotinaId, now: inicio });
  const w = await loadWorkout(db, id);
  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    await updateSet(db, w.exercises[0].sets[i].id, { weightKg: s.w, reps: s.r, type: s.type ?? 'normal', completed: true }, inicio + 60_000 * (i + 1));
  }
  await finishWorkout(db, id, { pending: 'discard', now: inicio + 3_600_000 });
  return id;
}

describe('validSetHistory', () => {
  it('sem treinos finalizados devolve vazio', async () => {
    expect(await validSetHistory(db, supino)).toEqual([]);
  });

  it('traz só séries válidas de treinos finalizados (aquecimento e pendentes ficam de fora)', async () => {
    await treino(T0, [{ w: 40, r: 12, type: 'warmup' }, { w: 80, r: 8 }, { w: 82.5, r: 6 }]);
    const h = await validSetHistory(db, supino);
    expect(h.map((s) => [s.weightKg, s.reps])).toEqual([[80, 8], [82.5, 6]]);
    h.forEach((s) => expect(s).toMatchObject({ type: 'normal', completedAt: expect.any(Number) }));
  });

  it('não inclui o treino ativo nem o excluído, e respeita excludeWorkoutId', async () => {
    const id = await treino(T0, [{ w: 80, r: 8 }]);
    const ativo = await startWorkout(db, { routineId: rotinaId, now: T0 + 10_000_000 });
    await updateSet(db, (await loadWorkout(db, ativo)).exercises[0].sets[0].id, { weightKg: 100, reps: 5, completed: true }, T0 + 10_060_000);
    expect((await validSetHistory(db, supino)).map((s) => s.weightKg)).toEqual([80]);
    expect(await validSetHistory(db, supino, id)).toEqual([]);
  });
});
