import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Database } from '@nozbe/watermelondb';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { finishWorkout, loadWorkout, startWorkout, swapExercise, updateSet } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';

// T-006a (b), decisão do PO (2026-11-28): ao trocar o exercício, cada série pendente movida pega os valores da MESMA POSIÇÃO
// na sessão anterior do exercício NOVO (série 1 com a 1, série 2 com a 2...). Se a sessão anterior teve menos séries que a
// posição pedida, repete a ÚLTIMA série dela (como o "+ série"). Sem sessão anterior do novo exercício, os campos ficam
// VAZIOS: nunca herdam carga ou reps do exercício antigo.
const SUPINO = 'Supino reto com barra';
const ROSCA = 'Rosca direta';
const D = 86_400_000;
const T0 = Date.now() - 3 * D;
const min = (n: number) => n * 60_000;

let db: Database;
let ids: Record<string, string>;
let workoutId: string;

async function sessaoAnteriorDaRosca() {
  const rotina = await saveRoutine(db, {
    name: 'Bíceps',
    exercises: [{ exerciseId: ids[ROSCA], sets: 2, weightKg: 15, repsMin: null, repsMax: 12, restSeconds: 60 }],
  });
  const id = await startWorkout(db, { routineId: rotina, now: T0 });
  const w = await loadWorkout(db, id);
  await updateSet(db, w.exercises[0].sets[0].id, { weightKg: 20, reps: 12, completed: true }, T0 + min(2));
  await updateSet(db, w.exercises[0].sets[1].id, { weightKg: 22.5, reps: 10, completed: true }, T0 + min(4));
  await finishWorkout(db, id, { now: T0 + min(30) });
}

beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const cat = await listCatalog(db);
  ids = Object.fromEntries([SUPINO, ROSCA].map((n) => [n, cat.find((e) => e.name === n)!.id]));
});

async function iniciarComSupino() {
  const rotina = await saveRoutine(db, {
    name: 'Peito',
    exercises: [{ exerciseId: ids[SUPINO], sets: 3, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 }],
  });
  workoutId = await startWorkout(db, { routineId: rotina, now: Date.now() });
  return (await loadWorkout(db, workoutId)).exercises[0];
}
const doExercicio = async (exerciseId: string) => (await loadWorkout(db, workoutId)).exercises.find((e) => e.exerciseId === exerciseId)!;

describe('trocar com sessão anterior do novo exercício', () => {
  beforeEach(sessaoAnteriorDaRosca);

  it('a 1ª série pendente movida pega a sessão anterior da rosca (20 kg × 12), não os 60 × 10 do supino', async () => {
    const supino = await iniciarComSupino();
    await swapExercise(db, supino.id, ids[ROSCA]);
    const [primeira] = (await doExercicio(ids[ROSCA])).sets;
    expect(primeira).toMatchObject({ weightKg: 20, reps: 12, completedAt: null });
  });

  it('cada pendente pega a série de MESMA POSIÇÃO da sessão anterior; a que passa do fim repete a ÚLTIMA (3 pendentes, sessão de 2 séries)', async () => {
    const supino = await iniciarComSupino();
    await swapExercise(db, supino.id, ids[ROSCA]);
    const sets = (await doExercicio(ids[ROSCA])).sets;
    expect(sets.map((s) => [s.weightKg, s.reps])).toEqual([
      [20, 12], // série 1 com a 1
      [22.5, 10], // série 2 com a 2
      [22.5, 10], // série 3: a sessão teve só 2, repete a última
    ]);
  });

  it('nenhuma pendente movida carrega a carga ou as reps do supino', async () => {
    const supino = await iniciarComSupino();
    await swapExercise(db, supino.id, ids[ROSCA]);
    expect((await doExercicio(ids[ROSCA])).sets.some((s) => s.weightKg === 60)).toBe(false);
  });

  it('com a 1ª série do supino já concluída, as 2 pendentes seguem a posição entre as movidas (1ª e 2ª da sessão anterior)', async () => {
    const supino = await iniciarComSupino();
    await updateSet(db, supino.sets[0].id, { weightKg: 60, reps: 10, completed: true });
    await swapExercise(db, supino.id, ids[ROSCA]);
    expect((await doExercicio(ids[ROSCA])).sets.map((s) => [s.weightKg, s.reps])).toEqual([
      [20, 12],
      [22.5, 10],
    ]);
  });

  it('com uma série já concluída no supino: ela fica com 60 × 10 e só as 2 pendentes pegam os valores da rosca', async () => {
    const supino = await iniciarComSupino();
    await updateSet(db, supino.sets[0].id, { weightKg: 60, reps: 10, completed: true });
    await swapExercise(db, supino.id, ids[ROSCA]);
    const antigo = await doExercicio(ids[SUPINO]);
    expect(antigo.sets).toHaveLength(1);
    expect(antigo.sets[0]).toMatchObject({ weightKg: 60, reps: 10, completedAt: expect.any(Number) });
    const novas = (await doExercicio(ids[ROSCA])).sets;
    expect(novas).toHaveLength(2);
    expect(novas[0]).toMatchObject({ weightKg: 20, reps: 12 });
  });
});

describe('trocar por um exercício sem sessão anterior', () => {
  it('as pendentes movidas ficam sem carga e sem reps (nunca herdam as do exercício antigo)', async () => {
    const supino = await iniciarComSupino();
    await swapExercise(db, supino.id, ids[ROSCA]);
    for (const s of (await doExercicio(ids[ROSCA])).sets) expect(s).toMatchObject({ weightKg: null, reps: null, completedAt: null });
  });
});
